import { ProgressPromise } from './ProgressPromise';

describe('ProgressPromise::then()', () => {
    it('should resolve static values', async () => {
        const promise = ProgressPromise.resolve(42);

        return promise.then((value) => expect(value).toBe(42));
    });

    it('should resolve another progress promise to itself', () => {
        const promise = ProgressPromise.resolve(42);

        expect(ProgressPromise.resolve(promise)).toBe(promise);
    });

    it('should report progress', async () => {
        const progressHistory: number[] = [];

        const promise = new ProgressPromise((resolve, _reject, progress) => {
            setTimeout(() => progress(25), 10);
            setTimeout(() => progress(50), 20);
            setTimeout(() => progress(75), 30);
            setTimeout(() => progress(100), 40);
            setTimeout(resolve, 50);
        });

        return promise.then(
            () => expect(progressHistory).toEqual([25, 50, 75, 100]),
            undefined,
            (progress) => progressHistory.push(progress),
        );
    });

    it('should properly handle chained returns', async () => {
        return new ProgressPromise((resolve) => resolve('Hello'))
            .then((value) => {
                return `${value} world`;
            })
            .then((value) => {
                return `${value}!`;
            })
            .then(
                (value) => expect(value).toBe('Hello world!'),
                () => fail('This should not happen'),
            );
    });

    it('should properly handle chained returned promises', async () => {
        return new ProgressPromise((resolve) => resolve('Hello'))
            .then((value) => {
                return new Promise((resolve) => resolve(`${value} world`));
            })
            .then((value) => {
                return new Promise((resolve) => resolve(`${value}!`));
            })
            .then(
                (value) => expect(value).toBe('Hello world!'),
                () => fail('This should not happen'),
            );
    });

    it('should properly handle chained errors', async () => {
        const errors: Error[] = [];

        return new ProgressPromise((_resolve, reject) => reject('Error #0'))
            .catch((error) => {
                errors.push(error);
                throw `Error #1`;
            })
            .catch((error) => {
                errors.push(error);
                throw `Error #2`;
            })
            .then(
                () => fail('This should not happen'),
                (error) => {
                    expect(errors).toEqual(['Error #0', 'Error #1']);
                    expect(error).toBe('Error #2');
                },
            );
    });

    it('should properly handle caught errors', async () => {
        return new ProgressPromise((_resolve, reject) => reject('Error'))
          .catch((error) => {
              return error;
          })
          .then(
            (value) => expect(value).toBe('Error'),
            () => fail('This should not happen'),
          );
    });

    it('should properly handle chained then/catch calls', async () => {
        return new ProgressPromise((resolve) => resolve('Hello'))
          .then(
            (value) => { throw value },
            () => fail('This should not happen.'),
          )
          .then(
            () => fail('This should not happen.'),
            (error) => `${error} world!`,
          )
          .then(
            (value) => expect(value).toBe('Hello world!'),
            () => fail('This should not happen.'),
          );
    });

    it('should properly unwrap nested promises', async () => {
        return new ProgressPromise<number>((resolve) => resolve(42))
          .then((value) => {
              return new ProgressPromise<number>((resolve) => resolve(value + 1))
                .then((value) => {
                    return new ProgressPromise<number>((resolve) => resolve(value + 1));
                })
          })
          .then(
            (value) => expect(value).toBe(44),
            () => fail('This should not happen'),
          );
    });



    it('should be compatible with async/await code', async () => {
        const value = await new ProgressPromise<number>((resolve) => resolve(42));

        expect(value).toBe(42);
    });
});
