const MIN_PROGRESS = 0;
const MAX_PROGRESS = 100;

type ProgressCallbackWithDetails<T> = (progress: number, details: T) => void;
type ProgressCallback = (progress: number) => void;

export class ProgressPromise<T, P extends any = undefined> implements PromiseLike<T> {
    private listeners: ((progress: number, progressDetails: P) => void)[] = [];

    private progress = MIN_PROGRESS;

    private promise: Promise<T>;

    constructor(
        executor: (
            resolve: (value: T | PromiseLike<T>) => void,
            reject: (reason?: any) => void,
            progress: P extends undefined ? ProgressCallback : ProgressCallbackWithDetails<P>,
        ) => void,
    ) {
        const report = (progress: number, details: P) => {
            if (progress <= MAX_PROGRESS && progress > this.progress) {
                this.progress = progress;
                this.listeners.forEach((listener) => listener(progress, details));
            }
        };

        this.promise = new Promise<T>((resolve, reject) => {
            // @ts-ignore
            executor(resolve, reject, report);
        });
    }

    static resolve<V>(value: V | PromiseLike<V>): ProgressPromise<V> {
        if (value instanceof ProgressPromise) {
            return value;
        }
        if (isPromiseLike(value)) {
            return new ProgressPromise((resolve, reject, reportProgress) => {
                // @ts-ignore
                value.then(resolve, reject, reportProgress);
            });
        }
        return new ProgressPromise(function (resolve, reject, reportProgress) {
            // @ts-ignore
            return Promise.resolve(value).then(resolve, reject, reportProgress);
        });
    }

    // @ts-ignore
    static all(): ProgressPromise<[], []>;

    static all<T, P = undefined>(
        values: (P extends undefined
            ? T | PromiseLike<T> | ProgressPromise<T>
            : ProgressPromise<T, P>)[],
    ): ProgressPromise<T[], P[]>;

    static all<T1, T2, P1 = undefined, P2 = undefined>(
        values: [
            P1 extends undefined
                ? T1 | PromiseLike<T1> | ProgressPromise<T1>
                : ProgressPromise<T1, P1>,
            P2 extends undefined
                ? T2 | PromiseLike<T2> | ProgressPromise<T2>
                : ProgressPromise<T2, P2>,
        ],
    ): ProgressPromise<[T1, T2], [P1, P2]>;

    static all<T1, T2, T3, P1 = undefined, P2 = undefined, P3 = undefined>(
        values: [
            P1 extends undefined
                ? T1 | PromiseLike<T1> | ProgressPromise<T1>
                : ProgressPromise<T1, P1>,
            P2 extends undefined
                ? T2 | PromiseLike<T2> | ProgressPromise<T2>
                : ProgressPromise<T2, P2>,
            P3 extends undefined
                ? T3 | PromiseLike<T3> | ProgressPromise<T3>
                : ProgressPromise<T3, P3>,
        ],
    ): ProgressPromise<[T1, T2, T3], [P1, P2, P3]>;

    static all<T1, T2, T3, T4, P1 = undefined, P2 = undefined, P3 = undefined, P4 = undefined>(
        values: [
            P1 extends undefined
                ? T1 | PromiseLike<T1> | ProgressPromise<T1>
                : ProgressPromise<T1, P1>,
            P2 extends undefined
                ? T2 | PromiseLike<T2> | ProgressPromise<T2>
                : ProgressPromise<T2, P2>,
            P3 extends undefined
                ? T3 | PromiseLike<T3> | ProgressPromise<T3>
                : ProgressPromise<T3, P3>,
            P4 extends undefined
                ? T4 | PromiseLike<T1> | ProgressPromise<T1>
                : ProgressPromise<T1, P1>,
        ],
    ): ProgressPromise<[T1, T2, T3, T4], [P1, P2, P3, P4]>;

    static all(promises: (any | PromiseLike<any>)[] = []): ProgressPromise<any[], any[]> {
        const length = promises.length;
        if (length === 0) {
            // @ts-ignore
            return ProgressPromise.resolve([]);
        }
        const results = new Array(length);
        const progressBuffer = new Array(length).fill(MIN_PROGRESS);
        const progressDetails = new Array(length).fill(undefined);
        let resolveCount = 0;

        return new ProgressPromise<any[], any[]>((resolve, reject, reportProgress) => {
            function notifyProgress(progress: number[], progressDetails: any[]) {
                const sumProgress = progress.reduce((sum, subProgress) => sum + subProgress, 0);
                reportProgress(sumProgress / length, progressDetails);
            }

            promises.forEach((promise, index) => {
                ProgressPromise.resolve(promise).then(
                    (subResult: any) => {
                        results[index] = subResult;
                        progressBuffer[index] = MAX_PROGRESS;
                        resolveCount += 1;
                        notifyProgress(progressBuffer, progressDetails);
                        if (resolveCount === length) {
                            resolve(results);
                        }
                        return subResult;
                    },
                    (subError: any) => reject(subError),
                    (subProgress: number, subProgressDetails: any) => {
                        progressBuffer[index] = clamp(
                            subProgress,
                            progressBuffer[index],
                            MAX_PROGRESS,
                        );
                        progressDetails[index] = subProgressDetails;
                        notifyProgress(progressBuffer, subProgressDetails);
                    },
                );
            });
        });
    }

    then<TResult1 = T, TResult2 = never>(
        onFulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>,
        onRejected?: (reason: any) => TResult2 | PromiseLike<TResult2>,
        onProgress?: (progress: number, details: P) => void,
    ): ProgressPromise<TResult1 | TResult2, P> {
        return new ProgressPromise((resolve, reject, report) => {
            this.listeners.push(report);
            if (onProgress) this.listeners.push(onProgress);

            return this.promise.then(onFulfilled, onRejected).then(resolve, reject);
        });
    }

    done = <TResult1 = T>(
        onFulfilled: (value: T) => TResult1 | PromiseLike<TResult1>,
    ): ProgressPromise<TResult1, P> => {
        return this.then<TResult1>(onFulfilled);
    };

    catch = <TResult2 = never>(onRejected: (reason: any) => TResult2 | PromiseLike<TResult2>) => {
        return this.then<T, TResult2>(undefined, onRejected);
    };

    onProgress = (onProgress: (progress: number, details: P) => void): ProgressPromise<T, P> => {
        return this.then<T>(undefined, undefined, onProgress);
    };
}

function isPromiseLike(value: any): value is PromiseLike<any> | ProgressPromise<any> {
    return value && typeof value.then === 'function';
}

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}
