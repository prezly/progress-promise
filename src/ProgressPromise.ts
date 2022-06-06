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
    //
    // static all(): ProgressPromise<void>;
    //
    // static all<T>(values: (T | PromiseLike<T>)[]): ProgressPromise<T[]>;
    //
    // static all<T1, T2>(
    //     values: [T1 | PromiseLike<T1>, T2 | PromiseLike<T2>],
    // ): ProgressPromise<[T1, T2]>;
    //
    // static all(promises?: (any | PromiseLike<any>)[]): ProgressPromise<void | any[], undefined> {
    //     if (!promises) {
    //         return new ProgressPromise<void>((resolve) => {
    //             resolve();
    //         });
    //     }
    //     const length = promises.length; // eslint-disable-line prefer-destructuring
    //     if (length === 0) {
    //         return new ProgressPromise<any[]>((resolve) => resolve([]));
    //     }
    //     const results = new Array(length);
    //     const progressBuffer = new Array(length).fill(MIN_PROGRESS);
    //     let resolveCount = 0;
    //
    //     return new ProgressPromise((resolve, reject, reportProgress) => {
    //         function notifyProgress(progress: number[]) {
    //             const sumProgress = progress.reduce((sum, subProgress) => sum + subProgress, 0);
    //             reportProgress(sumProgress / length);
    //         }
    //
    //         promises.forEach((promise, index) => {
    //             ProgressPromise.resolve(promise).then(
    //                 (subResult: any) => {
    //                     results[index] = subResult;
    //                     progressBuffer[index] = MAX_PROGRESS;
    //                     resolveCount += 1;
    //                     notifyProgress(progressBuffer);
    //                     if (resolveCount === length) {
    //                         resolve(results);
    //                     }
    //                     return subResult;
    //                 },
    //                 (subError: any) => reject(subError),
    //                 (subProgress: number) => {
    //                     progressBuffer[index] = clamp(
    //                         subProgress,
    //                         progressBuffer[index],
    //                         MAX_PROGRESS,
    //                     );
    //                     notifyProgress(progressBuffer);
    //                 },
    //             );
    //         });
    //     });
    // }

    then<TResult1 = T, TResult2 = never>(
        onFulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>,
        onRejected?: (reason: any) => TResult2 | PromiseLike<TResult2>,
        onProgress?: (progress: number, details: P) => void,
    ): ProgressPromise<TResult1 | TResult2, P> {
        return new ProgressPromise((resolve, reject, report) => {
            this.listeners.push(report);
            if (onProgress) this.listeners.push(onProgress);

            return this.promise
              .then(onFulfilled, onRejected)
              .then(resolve, reject);
        });
    }

    done = <TResult1 = T>(
        onFulfilled: (value: T) => TResult1 | PromiseLike<TResult1>,
    ): ProgressPromise<TResult1, P> => {
        return this.then<TResult1>(onFulfilled);
    }

    catch = <TResult2 = never>(onRejected: (reason: any) => TResult2 | PromiseLike<TResult2>) => {
        return this.then<T, TResult2>(undefined, onRejected);
    }

    onProgress = (
        onProgress: (progress: number, details: P) => void,
    ): ProgressPromise<T, P> => {
        return this.then<T>(undefined, undefined, onProgress);
    };
}

function isPromiseLike(value: any): value is PromiseLike<any> | ProgressPromise<any> {
    return value && typeof value.then === 'function'
}
