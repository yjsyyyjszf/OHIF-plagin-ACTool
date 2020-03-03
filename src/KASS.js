import {mean} from "mathjs";
import {ChamferDistance} from "./ChamferDistance";

export const KASS = function () {

    function KASS(params) {

        this.maxIteration = params.maxIteration || 250;
        this.minlen = params.minlen || Math.pow(.1, 2);
        this.maxlen = params.maxlen || Math.pow(5, 2);
        this.params = params;//
        this.w = params.width;
        this.h = params.height;

        var grayscaleImage = params.image;

        var Sobel = filtrSobel(grayscaleImage, this.w, this.h);

        this.threshold = params.threshold || mean(Sobel);

        console.log(this.threshold);//

        this.gradient = thresholding(Sobel, this.h, this.w, this.threshold);
        this.flow = getFlow(this.gradient, this.w, this.h);
        this.dots = params.dots;//

        this.length = 0;
        this.snake = this.dots;//

        //binding the scope for animationFrameRequests
        this.update = this.update.bind(this);
        this.render = params.render;
        this.stopped = false;

    }

    // compute -> update -> loop, _render ->
    function compute(_onComplete) {

        this.onComplete = _onComplete;

        this.snake = this.dots;

        this.it = 0;
        this.length = 0;
        this.last = this.getsnakelength();
        cancelAnimationFrame(this.interval);

        this.update();
    }

    function update() {
        if (this.stopped) {
            this.stopped = false;

            cancelAnimationFrame(this.interval);
            this._render(true);

            return
        }
        this.loop();
        this._render();
        this.length = this.getsnakelength();
        if (++this.it >= this.maxIteration) {
            cancelAnimationFrame(this.interval);
            this._render(true);
        } else {
            this.last = this.length;
            setTimeout(this.update, 0)

        }
    }

    function loop() {


        var alpha = 1.1, beta = 1.2, gamma = 1.5;

        var wSize = 2;

        var e_uniformity = init2DArray(wSize + 1, wSize + 1);
        var e_curvature = init2DArray(wSize + 1, wSize + 1);
        //var e_flow = init2DArray(wSize + 1, wSize + 1);


        let p = [];
        this.length = this.getsnakelength();


        var newsnake = [];

        for (let i = 0; i < this.snake.length; i++) {
            let prev = this.snake[(i + this.snake.length - 1) % this.snake.length];
            let cur = this.snake[i];
            let next = this.snake[(i + 1) % this.snake.length];

            for (let dy = (wSize / 2) * -1; dy <= (wSize / 2); dy++) {
                for (let dx = (wSize / 2) * -1; dx <= (wSize / 2); dx++) {
                    p[0] = cur[0] + dx;
                    p[1] = cur[1] + dy;

                    e_uniformity[1 + dx][1 + dy] = f_uniformity(prev, this.length, p, this.snake.length);
                    e_curvature[(wSize / 2) + dx][(wSize / 2) + dy] = f_curvature(prev, p, next);
                }
            }

            normalize(e_uniformity);
            normalize(e_curvature);

            let emin = Number.MAX_VALUE;
            let e = 0;
            let x = 0, y = 0;

            for (let dy = (wSize / 2) * -1; dy <= (wSize / 2); dy++) {
                for (let dx = (wSize / 2) * -1; dx <= (wSize / 2); dx++) {
                    e = 0;
                    e += alpha * e_uniformity[1 + dx][1 + dy]; // internal energy
                    e += beta * e_curvature[(wSize / 2) + dx][(wSize / 2) + dy];  // internal energy
                    //e += gamma * e_flow[(wSize / 2) + dx][(wSize / 2) + dy];  // external energy
                    if (e < emin) {
                        emin = e;
                        x = cur[0] + dx;
                        y = cur[1] + dy;
                    }
                }
            }

            if (x < 1) x = 1;
            if (x >= (this.width - 1)) x = this.width - 2;
            if (y < 1) y = 1;
            if (y >= (this.height - 1)) y = this.height - 2;

            newsnake.push([x, y]);
        }
        this.snake = newsnake;

        //add / remove splain (TODO change on cubic + energy + refactor)
        var tmp = [];
        for (var i = 0; i < this.snake.length; i++) {

            var prev = this.snake[(i - 1 < 0 ? this.snake.length - 1 : (i - 1))];
            var cur = this.snake[i];
            var next = this.snake[(i + 1) % this.snake.length];

            var dist = distance(prev, cur) + distance(cur, next);

            //if the length is too short, don't use this point anymore
            if (dist > this.minlen) {

                //if it is below the max length
                if (dist < this.maxlen) {
                    //store the point
                    tmp.push(cur);

                } else {
                    //otherwise split the previous and the next edges
                    var pp = [lerp(.5, prev[0], cur[0]), lerp(.5, prev[1], cur[1])];
                    var np = [lerp(.5, cur[0], next[0]), lerp(.5, cur[1], next[1])];

                    // and add the midpoints to the snake
                    tmp.push(pp, np);
                }
            }
        }
        this.snake = tmp;

        return this.snake;
    }

    function _render(finished) {
        this.render(this.snake, this.it, this.last, finished);
    }

    function init2DArray(rows, columns) {
        let arr = [];
        for (let i = 0; i < rows; i++) {
            arr[i] = [];
            for (let j = 0; j < columns; j++) {
                arr[i][j] = 0;
            }
        }
        return arr;
    }

    function normalize(array3x3) {
        let sum = 0;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                sum += Math.abs(array3x3[i][j]);
            }
        }

        if (sum === 0) return;

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                array3x3[i][j] /= sum;
            }
        }
    }

    function f_uniformity(prev, snakelength, p, snakesize) {

        // length of previous segment
        let un = distance(prev, p);

        // mesure of uniformity
        let avg = snakelength / snakesize;
        let dun = Math.abs(un - avg);

        // elasticity energy
        return dun * dun;
    }

    function f_curvature(prev, p, next) {
        let ux = p[0] - prev[0];
        let uy = p[1] - prev[1];
        let un = Math.sqrt(ux * ux + uy * uy);

        let vx = p[0] - next[0];
        let vy = p[1] - next[1];
        let vn = Math.sqrt(vx * vx + vy * vy);

        if (un === 0 || vn === 0) return 0;

        let cx = (vx + ux) / (un * vn);
        let cy = (vy + uy) / (un * vn);

        // curvature energy
        let cn = cx * cx + cy * cy;
        return cn;
    }

    function filtrSobel(data, columns, rows) {

        let channelGradient = init2DArray(rows, columns);

        let maxgradient = 0;
        for (let y = 0; y < rows - 2; y++) {
            for (let x = 0; x < columns - 2; x++) {
                let p00 = data[y][x];
                let p10 = data[y + 1][x];
                let p20 = data[y + 2][x];
                let p01 = data[y][x + 1];
                let p21 = data[y + 2][x + 1];
                let p02 = data[y][x + 2];
                let p12 = data[y + 1][x + 2];
                let p22 = data[y + 2][x + 2];
                let sx = (p20 + 2 * p21 + p22) - (p00 + 2 * p01 + p02);
                let sy = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p10);
                let snorm = Math.floor(Math.sqrt(sx * sx + sy * sy));
                channelGradient[y + 1][x + 1] = snorm;
                maxgradient = Math.max(maxgradient, snorm);
            }
        }

        return channelGradient;

    }

    function thresholding(channelGradient, rows, columns, threshold) {
        let binarygradient = init2DArray(rows, columns);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                if (channelGradient[y][x] > threshold) {
                    binarygradient[y][x] = 1;
                } else {
                    channelGradient[y][x] = 0;
                }
            }
        }
        return binarygradient;
    }

    function getFlow(binarygradient, columns, rows) {
        //ChamferDistance
        let dist = ChamferDistance.compute(ChamferDistance.chamfer13, binarygradient, columns, rows);

        //channelFlow
        let channelFlow = init2DArray(rows, columns);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                channelFlow[x][y] = Math.floor(dist[x][y])
            }
        }
        return channelFlow;
    }

    // total length of snake
    function getsnakelength() {
        var length = 0;
        for (var i = 0; i < this.snake.length; i++) {
            var cur = this.snake[i];
            var next = this.snake[(i + 1) % this.snake.length];
            length += distance(cur, next);
        }
        return length;
    }

    function distance(a, b) {
        var dx = a[0] - b[0];
        var dy = a[1] - b[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function lerp(t, a, b) {
        return a + t * (b - a);
    }

    var p = KASS.prototype;
    p.constructor = KASS;
    p.compute = compute;
    p.update = update;
    p.loop = loop;
    p._render = _render;
    p.getsnakelength = getsnakelength;
    return KASS;
}();