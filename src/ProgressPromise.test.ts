import { ProgressPromise } from './ProgressPromise';

describe('ProgressPromise.then()', () => {
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
            .catch((error) => error)
            .then(
                (value) => expect(value).toBe('Error'),
                () => fail('This should not happen'),
            );
    });

    it('should properly handle chained then/catch calls', async () => {
        return new ProgressPromise((resolve) => resolve('Hello'))
            .then(
                (value) => {
                    throw value;
                },
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
                return new ProgressPromise<number>((resolve) => resolve(value + 1)).then(
                    (value) => {
                        return new ProgressPromise<number>((resolve) => resolve(value + 1));
                    },
                );
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

describe('ProgressPromise.all()', () => {
    it('should resolve to an empty array if no promises were given', async () => {
        await ProgressPromise.all().then((value) => expect(value).toEqual([]));
        await ProgressPromise.all([]).then((value) => expect(value).toEqual([]));
    });

    it('should report progress for multiple non-ProgressPromise promises', async () => {
        const progressHistory: number[] = [];
        await ProgressPromise.all([
            new Promise((resolve) => setTimeout(resolve, 500)),
            new Promise((resolve) => setTimeout(resolve, 400)),
            new Promise((resolve) => setTimeout(resolve, 300)),
            new Promise((resolve) => setTimeout(resolve, 200)),
            new Promise((resolve) => setTimeout(resolve, 100)),
        ]).then(undefined, undefined, (progress) => progressHistory.push(progress));

        expect(progressHistory).toEqual([20, 40, 60, 80, 100]);
    });

    it('should resolve to the array list containing resolved values from individual promises', async () => {
        await ProgressPromise.all([
            new Promise((resolve) => setTimeout(() => resolve(500), 500)),
            new Promise((resolve) => setTimeout(() => resolve(400), 400)),
            new Promise((resolve) => setTimeout(() => resolve(300), 300)),
            new Promise((resolve) => setTimeout(() => resolve(200), 200)),
            new Promise((resolve) => setTimeout(() => resolve(100), 100)),
        ]).then((value) => expect(value).toEqual([500, 400, 300, 200, 100]));
    });

    it('should report detailed progress for nested ProgressPromise promises', async () => {
        const progressHistory: number[] = [];
        await ProgressPromise.all([
            new ProgressPromise((resolve, _reject, progress) => {
                setTimeout(() => progress(20), 100);
                setTimeout(() => progress(40), 200);
                setTimeout(() => progress(60), 300);
                setTimeout(() => progress(80), 400);
                setTimeout(() => progress(100), 500);
                setTimeout(resolve, 600);
            }),
            new ProgressPromise((resolve, _reject, progress) => {
                setTimeout(() => progress(20), 50);
                setTimeout(() => progress(40), 150);
                setTimeout(() => progress(60), 250);
                setTimeout(() => progress(80), 350);
                setTimeout(() => progress(100), 450);
                setTimeout(resolve, 550);
            }),
        ]).then(undefined, undefined, (progress) => progressHistory.push(progress));

        expect(progressHistory).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    });

    it('should report progress providing array of individual progress reports details', async () => {
        const progressHistory: number[] = [];
        const progressDetailsHistory: any[] = [];
        await ProgressPromise.all([
            new ProgressPromise<void, { x: number }>((resolve, _reject, progress) => {
                setTimeout(() => progress(20, { x: 20 }), 100);
                setTimeout(() => progress(40, { x: 40 }), 200);
                setTimeout(() => progress(60, { x: 60 }), 300);
                setTimeout(() => progress(80, { x: 80 }), 400);
                setTimeout(() => progress(100, { x: 100 }), 500);
                setTimeout(resolve, 600);
            }),
            new ProgressPromise<void, { y: number }>((resolve, _reject, progress) => {
                setTimeout(() => progress(20, { y: 20 }), 50);
                setTimeout(() => progress(40, { y: 40 }), 150);
                setTimeout(() => progress(60, { y: 60 }), 250);
                setTimeout(() => progress(80, { y: 80 }), 350);
                setTimeout(() => progress(100, { y: 100 }), 450);
                setTimeout(resolve, 550);
            }),
        ]).then(undefined, undefined, (progress, details) => {
            progressHistory.push(progress);
            progressDetailsHistory.push([...details]);
        });

        expect(progressHistory).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
        expect(progressDetailsHistory).toEqual([
            [undefined, { y: 20 }],
            [{ x: 20 }, { y: 20 }],
            [{ x: 20 }, { y: 40 }],
            [{ x: 40 }, { y: 40 }],
            [{ x: 40 }, { y: 60 }],
            [{ x: 60 }, { y: 60 }],
            [{ x: 60 }, { y: 80 }],
            [{ x: 80 }, { y: 80 }],
            [{ x: 80 }, { y: 100 }],
            [{ x: 100 }, { y: 100 }],
        ]);
    });
});
