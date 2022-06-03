import { ProgressPromise } from './ProgressPromise';

describe('ProgressPromise', () => {
    it('should resolve static values', () => {
        const promise = ProgressPromise.resolve(42);

        promise.then((value) => expect(value).toBe(42));
    });

    it('should resolve another progress promise to itself', () => {
        const promise = ProgressPromise.resolve(42);

        expect(ProgressPromise.resolve(promise)).toBe(promise);
    });

    it('should report progress', () => {
        const progressHistory: number[] = [];

        const promise = new ProgressPromise((resolve, _reject, progress) => {
            setTimeout(() => progress(25), 10);
            setTimeout(() => progress(50), 20);
            setTimeout(() => progress(75), 30);
            setTimeout(() => progress(100), 40);
            setTimeout(resolve, 50);
        });

        promise.then(
          () => expect(progressHistory).toEqual([25, 50, 75, 100]),
          undefined,
          (progress) => progressHistory.push(progress),
        )
    });
});
