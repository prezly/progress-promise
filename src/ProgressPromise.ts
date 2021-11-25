import identity from 'lodash.identity';
import clamp from 'lodash.clamp';

const MIN_PROGRESS = 0;
const MAX_PROGRESS = 100;

export class ProgressPromise<T, P = any> implements PromiseLike<T> {
    private listeners: ((progress: number, progressDetails: P | null) => void)[] = [];

    private progress = MIN_PROGRESS;

    private promise: Promise<T>;

    constructor(
        executor: (
            resolve: (value: T | PromiseLike<T>) => void,
            reject: (reason?: any) => void,
            progress: (progress: number, progressDetails?: P | null) => void,
        ) => void,
    ) {
        const reportProgress = (progress: number, progressDetails?: P | null) => {
            if (progress <= MAX_PROGRESS && progress > this.progress) {
                this.progress = progress;
                this.listeners.forEach((listener) => listener(progress, progressDetails || null));
            }
        };

        this.promise = new Promise<T>((resolve, reject) => {
            executor(resolve, reject, reportProgress);
        });
    }

    static resolve<V>(value: V | PromiseLike<V>): ProgressPromise<V> {
        if (value instanceof ProgressPromise) {
            return value;
        }
        return new ProgressPromise((resolve, reject) =>
            Promise.resolve(value).then(resolve, reject),
        );
    }

    static all(): ProgressPromise<void>;
    static all<T>(values: (T | PromiseLike<T>)[]): ProgressPromise<T[]>;
    static all<T1, T2>(
        values: [T1 | PromiseLike<T1>, T2 | PromiseLike<T2>],
    ): ProgressPromise<[T1, T2]>;
    static all(promises?: (any | PromiseLike<any>)[]): ProgressPromise<void | any[], undefined> {
        if (!promises) {
            return new ProgressPromise<void>((resolve) => {
                resolve();
            });
        }
        const length = promises.length; // eslint-disable-line prefer-destructuring
        if (length === 0) {
            return new ProgressPromise<any[]>((resolve) => resolve([]));
        }
        const results = new Array(length);
        const progressBuffer = new Array(length).fill(MIN_PROGRESS);
        let resolveCount = 0;

        return new ProgressPromise((resolve, reject, reportProgress) => {
            function notifyProgress(progress: number[]) {
                const sumProgress = progress.reduce((sum, subProgress) => sum + subProgress, 0);
                reportProgress(sumProgress / length);
            }

            promises.forEach((promise, index) => {
                ProgressPromise.resolve(promise).then(
                    (subResult: any) => {
                        results[index] = subResult;
                        progressBuffer[index] = MAX_PROGRESS;
                        resolveCount += 1;
                        notifyProgress(progressBuffer);
                        if (resolveCount === length) {
                            resolve(results);
                        }
                        return subResult;
                    },
                    (subError: any) => reject(subError),
                    (subProgress: number) => {
                        progressBuffer[index] = clamp(
                            subProgress,
                            progressBuffer[index],
                            MAX_PROGRESS,
                        );
                        notifyProgress(progressBuffer);
                    },
                );
            });
        });
    }

    then<TResult1 = T, TResult2 = never>(
        onFulfilled: (value: T) => TResult1 | PromiseLike<TResult1> = identity,
        onRejected: (reason: any) => TResult2 | PromiseLike<TResult2> = identity,
        onProgress: (progress: number, progressDetails: P | null) => void = identity,
    ): ProgressPromise<TResult1 | TResult2, P> {
        return new ProgressPromise((resolve, reject, reportProgress) => {
            try {
                this.promise.then(
                    (value) => resolve(onFulfilled(value)),
                    (reason: any) => reject(onRejected(reason)),
                );
                this.listeners.push((progress, progressDetails) => {
                    onProgress(progress, progressDetails);
                    reportProgress(progress, progressDetails);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    done<TResult1 = T>(
        onFulfilled: (value: T) => TResult1 | PromiseLike<TResult1>,
    ): ProgressPromise<TResult1> {
        return this.then(onFulfilled);
    }

    catch<TResult2 = never>(onRejected: (reason: any) => TResult2 | PromiseLike<TResult2>) {
        return this.then<T, TResult2>(undefined, onRejected);
    }

    onProgress = (
        onProgress: (progress: number, progressDetails: P | null) => void,
    ): ProgressPromise<T> => {
        return this.then(undefined, undefined, onProgress);
    };

    public getProgress(): number {
        return this.progress;
    }
}
