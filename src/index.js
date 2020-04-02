import csTools from "cornerstone-tools";
import cornestone from "cornerstone-core";

import debounce from 'lodash/debounce';
import {ACM} from './acm_test'

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


        this.runAnimation = debounce(evt => {

            let points = this.initPoints;
            //this.initPoints = [];

            const canvas = document.getElementsByClassName(
                'cornerstone-canvas'
            )[0];

            const canvasContext = canvas.getContext('2d');
            const it = 500;
            const thresh = 0.6;

            const originalPicture = new Image();
            originalPicture.src = canvas.toDataURL();

            var acm = new ACM({

                maxIteration: it,
                minlen: 1,
                maxlen: 3,
                threshold: thresh,

                imageData: this.imagePixelData,
                width: this.width,
                height: this.height,
                dots: [...points],

                render(snake, i, iLength, finished) {

                    //if(finished){
                    // this.finishSnake = snake
                    //}

                    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
                    canvasContext.drawImage(originalPicture, 0, 0);
                    canvasContext.lineWidth = 2;
                    canvasContext.strokeStyle = "rgb(0,255,0)";
                    canvasContext.beginPath();

                    snake.forEach(function (p) {
                        let point = {x: 0, y: 0};
                        point.x = p[0];
                        point.y = p[1];
                        let canvasPoint = cornestone.pixelToCanvas(evt.detail.element, point);
                        canvasContext.lineTo(canvasPoint.x, canvasPoint.y);
                    });

                    canvasContext.closePath();
                    canvasContext.stroke();


                }
            });

            acm.compute();

        }, 1000);


    }

    preMouseDownCallback(evt) {

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

        //console.log(this.initPoints);

        //Active contour
        //console.log('run AC');
        //this.runAnimation(evt);

        //Segmentation

        csTools.setToolActive('StackScrollMouseWheel', {});

    }

    renderBrush(evt) {

        if (this._drawing) {

            this.initPoints = [];

            const eventData = evt.detail;
            const {getters} = segmentationModule;
            const context = eventData.canvasContext;
            const element = eventData.element;
            let mouseStartPosition, mouseEndPosition;


            mouseEndPosition = this._lastImageCoords;
            mouseStartPosition = this.startCoords;
            context.strokeStyle = "rgba(0,255,0)";


            if (!mouseStartPosition) {
                return;
            }

            const {rows, columns} = eventData.image;
            const {x, y} = mouseStartPosition;

            if (x < 0 || x > columns || y < 0 || y > rows) {
                return;
            }

            context.setTransform(1, 0, 0, 1, 0, 0);

            const {labelmap2D} = getters.labelmap2D(element);

            const getPixelIndex = (x, y) => y * columns + x;
            const spIndex = getPixelIndex(Math.floor(x), Math.floor(y));
            const isInside = labelmap2D.pixelData[spIndex] === 1;
            this.shouldErase = !isInside;

            context.beginPath();

            let startCoordsCanvas = window.cornerstone.pixelToCanvas(
                element,
                mouseStartPosition,
            );

            let endCoordsCanvas = window.cornerstone.pixelToCanvas(
                element,
                mouseEndPosition,
            );

            context.moveTo(startCoordsCanvas.x,startCoordsCanvas.y);
            context.lineTo(endCoordsCanvas.x,endCoordsCanvas.y);

            context.stroke();
            this._lastImageCoords = eventData.image;

        }

    }
}

function generateEllipse(mouseStartPosition, width, height, n) {
    let points = [];
    let x, y;

    for (let i = 0; i < n; i++) {
        x = Math.floor(mouseStartPosition.x.valueOf() + Math.floor(Math.cos(2 * Math.PI / n * i) * (width / 2)));
        y = Math.floor(mouseStartPosition.y.valueOf() + Math.floor(Math.sin(2 * Math.PI / n * i) * (height / 2)));
        points.push([x, y]);

    }

    //console.log(points);

    return points;
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