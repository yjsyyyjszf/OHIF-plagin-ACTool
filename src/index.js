import csTools from "cornerstone-tools";
import cornestone from "cornerstone-core";

import {ChamferDistance} from './acm_test'

const {drawBrushPixels} = csTools.importInternal(
    'util/segmentationUtils'
);
const segmentationModule = csTools.getModule('segmentation');
const BaseBrushTool = csTools.importInternal("base/BaseBrushTool");
const MouseCursor = csTools.importInternal('tools/cursors/MouseCursor');

const activeContourCursor = new MouseCursor(
    `<path stroke="ACTIVE_COLOR" fill="none" stroke-width="3" d="M30.74 15.76C30.74 20.99 24.14 25.23 16
    25.23C7.86 25.23 1.26 20.99 1.26 15.76C1.26 10.54 7.86 6.3 16 6.3C24.14
    6.3 30.74 10.54 30.74 15.76Z"
    />`,
    {
        viewBox: {
            x: 32,
            y: 32,
        },
    }
);


export default class ACTool extends BaseBrushTool {

    constructor(props = {}) {
        const defaultProps = {
            name: 'ACTool',
            supportedInteractionTypes: ['Mouse', 'Touch'],
            svgCursor: activeContourCursor
        };

        super(props, defaultProps);
        this.preMouseDownCallback = this.preMouseDownCallback.bind(this);
        this._drawingMouseUpCallback = this._drawingMouseUpCallback.bind(this);
        this.renderBrush = this.renderBrush.bind(this);
        this.mouseDragCallback = this.mouseDragCallback.bind(this);
        this._paint = this._paint.bind(this);


    }

    preMouseDownCallback(evt) {

        //for drawing
        this.coord = [];

        // Lock switching images when rendering data
        csTools.setToolDisabled('StackScrollMouseWheel', {});

        const eventData = evt.detail;
        const {element, currentPoints} = eventData;

        // init image
        const {rows, columns} = eventData.image;
        this.width = columns;
        this.height = rows;

        const generalSeriesModuleMeta = cornerstone.metaData.get(
            'generalSeriesModule',
            eventData.image.imageId
        );

        const pixelArray = eventData.image.getPixelData();
        let grayScale;

        // add other cases
        switch (generalSeriesModuleMeta.modality) {
            case 'CT':
                grayScale = pixelArray.map(value =>
                    Math.round(((value + 2048) / 4096) * 255)
                );
                break;

            default:
                grayScale = pixelArray;
        }

        this.imagePixelData = get2DArray(grayScale, rows, columns);

        // Start point
        this.startCoords = currentPoints.image;

        this._drawing = true;
        super._startListeningForMouseUp(element);
        this._lastImageCoords = currentPoints.image;

        return true;
    }

    mouseDragCallback(evt) {

        const {currentPoints} = evt.detail;

        // Current point
        this.finishCoords = currentPoints.image;
        this._lastImageCoords = currentPoints.image;

        cornerstone.updateImage(evt.detail.element);
    }

    _drawingMouseUpCallback(evt) {

        const eventData = evt.detail;
        const {element, currentPoints} = eventData;
        this.finishCoords = currentPoints.image;
        this._drawing = false;
        super._stopListeningForMouseUp(element);

        this._paint(evt);
    }

    _paint(evt) {

        console.log('init');
        console.log(this.coord);

        console.log('result');
        this.result = computeACM(100,3,6,0.6,this.width,this.height,this.imagePixelData,[...this.coord.map(it => [...it])]);
        console.log(this.result);
        csTools.setToolActive('StackScrollMouseWheel', {});

    }

    renderBrush(evt) {

        if (this._drawing) {

            const eventData = evt.detail;
            const context = eventData.canvasContext;
            const element = eventData.element;
            let mouseEndPosition;


            mouseEndPosition = this._lastImageCoords;

            //let endCoordsCanvas = cornestone.pixelToCanvas(element, mouseEndPosition); //canvas
            context.strokeStyle = "rgba(0,255,0)";
            this.coord.push([mouseEndPosition.x.valueOf(), mouseEndPosition.y.valueOf()]);


            context.clearRect(0, 0, context.width, context.height);

            context.beginPath();
            context.moveTo(this.coord[0][0], this.coord[0][1]);


            for (let i = 1; i < this.coord.length; i++) {
                context.lineTo(this.coord[i][0], this.coord[i][1]);
            }


            context.closePath();
            context.stroke();

            this._lastImageCoords = eventData.image;

        }

    }
}


function get2DArray(imagePixelData, height, width) {
    let Array2d = [];
    for (let i = 0; i < height; i++) {
        Array2d.push(
            Array.from(imagePixelData.slice(i * width, (i + 1) * width))
        );
    }
    return Array2d;
}

function computeACM(maxIt, minLen, maxLen, threshold, w, h, imageData, initPoints) {

    let contours = [];
    let snake = initPoints;


    var result = ChamferDistance.compute(ChamferDistance.chamfer13, imageData, threshold, w, h);

    let flowX = result[0];
    let flowY = result[1];

    for (let i = 0; i < maxIt; i++) {
        snake.forEach(function (p) {
            if (p[0] <= 0 || p[0] >= w - 1 || p[1] <= 0 || p[1] >= h - 1) return;
            var vx = (.5 - flowX[~~(p[0])][~~(p[1])]) * 2;
            var vy = (.5 - flowY[~~(p[0])][~~(p[1])]) * 2;
            p[0] += vx * 100;
            p[1] += vy * 100;
        });

        //add / remove
        var tmp = [];
        for (var j = 0; j < snake.length; j++) {

            var prev = snake[(j - 1 < 0 ? snake.length - 1 : (j - 1))];
            var cur = snake[j];
            var next = snake[(j + 1) % snake.length];

            var dist = distance(prev, cur) + distance(cur, next);

            //if the length is too short, don't use this point anymore
            if (dist > minLen) {

                //if it is below the max length
                if (dist < maxLen) {
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
        snake = tmp;
        contours.push(snake);
    }

    return contours;
}

// total length of snake
function getsnakelength(snake) {
    var length = 0;
    for (var i = 0; i < snake.length; i++) {
        var cur = snake[i];
        var next = snake[(i + 1) % snake.length];
        length += distance(cur, next);
    }
    return length;
}

function distance(a, b) {
    var dx = a[0] - b[0];
    var dy = a[1] - b[1];
    return dx * dx + dy * dy;
}

function lerp(t, a, b) {
    return a + t * (b - a);
}