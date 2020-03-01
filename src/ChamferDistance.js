export const ChamferDistance = function (chamfer) {

    chamfer.cheessboard = [[1, 0, 1], [1, 1, 1]];
    chamfer.chamfer3 = [[1, 0, 3], [1, 1, 4]];
    chamfer.chamfer5 = [[1, 0, 5], [1, 1, 7], [2, 1, 1]];
    chamfer.chamfer7 = [[1, 0, 14], [1, 1, 20], [2, 1, 31], [3, 1, 44]];
    chamfer.chamfer13 = [[1, 0, 68], [1, 1, 96], [2, 1, 152], [3, 1, 215], [3, 2, 245], [4, 1, 280], [4, 3, 340], [5, 1, 346], [6, 1, 413]];

    chamfer.chamfer = null;
    chamfer.width = 0;
    chamfer.height = 0;
    chamfer.normalizer = 0;

    chamfer.init2DArray = function (w, h) {
        var arr = [];
        for (var x = 0; x < w; x++) {
            arr.push(new Float32Array(h));
        }
        return arr;
    };

    function testAndSet(output, x, y, newvalue) {
        if (x < 0 || x >= chamfer.width) return;
        if (y < 0 || y >= chamfer.height) return;
        var v = output[x][y];
        if (v >= 0 && v < newvalue) return;
        output[x][y] = newvalue;
    }

    chamfer.compute = function (chamfermask, input, width, height) {

        chamfer.chamfer = chamfermask || chamfer.chamfer13;
        chamfer.width = width;
        chamfer.height = height;
        chamfer.normalizer = chamfer.chamfer[0][2];
        let output = chamfer.init2DArray(width, height);

        // initialize distance
        for (let y = 0; y < chamfer.height; y++) {
            for (let x = 0; x < chamfer.width; x++) {
                if (input[x][y]) {
                    output[x][y] = 0; // inside the object -> distance=0
                } else {
                    output[x][y] = -1; // outside the object -> to be computed
                }
            }
        }

        // forward
        for (let y = 0; y <= chamfer.height - 1; y++) {
            for (let x = 0; x <= chamfer.width - 1; x++) {
                let v = output[x][y];
                if (v < 0) continue;
                for (let k = 0; k < chamfer.chamfer.length; k++) {
                    let dx = chamfer.chamfer[k][0];
                    let dy = chamfer.chamfer[k][1];
                    let dt = chamfer.chamfer[k][2];

                    testAndSet(output, x + dx, y + dy, v + dt);
                    if (dy !== 0) {
                        testAndSet(output, x - dx, y + dy, v + dt);
                    }
                    if (dx !== dy) {
                        testAndSet(output, x + dy, y + dx, v + dt);
                        if (dy !== 0) {
                            testAndSet(output, x - dy, y + dx, v + dt);
                        }
                    }
                }
            }
        }

        // backward
        for (let y = chamfer.height - 1; y >= 0; y--) {
            for (let x = chamfer.width - 1; x >=0; x--) {
                let v = output[x][y];
                if (v < 0) continue;
                for (let k = 0; k < chamfer.chamfer.length; k++) {
                    let dx = chamfer.chamfer[k][0];
                    let dy = chamfer.chamfer[k][1];
                    let dt = chamfer.chamfer[k][2];

                    testAndSet(output, x - dx, y - dy, v + dt);
                    if (dy !== 0) {
                        testAndSet(output, x + dx, y - dy, v + dt);
                    }
                    if (dx !== dy) {
                        testAndSet(output, x - dy, y - dx, v + dt);
                        if (dy !== 0) {
                            testAndSet(output, x + dy, y - dx, v + dt);
                        }
                    }
                }
            }
        }

        // normalize
        for (let y = 0; y < chamfer.height; y++) {
            for (let x = 0; x < chamfer.width; x++) {
                output[x][y] = output[x][y] / chamfer.normalizer;
            }
        }

        return output;

    };

    return chamfer;
}({});