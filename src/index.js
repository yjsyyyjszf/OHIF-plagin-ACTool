import csTools from "cornerstone-tools";
import cornestone from "cornerstone-core";


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
        this.initPoints = [];


    }

    preMouseDownCallback(evt) {

        // Lock switching images when rendering data
        csTools.setToolDisabled('StackScrollMouseWheel', {});

        const eventData = evt.detail;
        const {element, currentPoints} = eventData;

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
        const numberOfPoints = 100;
        // if contour - ellipse
        // bag - scale
        // Pixel coord, not canvas
        this.initPoints = generateEllipse(this.startCoords, this.ellipseWidth, this.ellipseHeight, numberOfPoints);
        // else...
        console.log(this.initPoints);
        this.initPoints = []
    }

    renderBrush(evt) {
        if (this._drawing) {

            const eventData = evt.detail;
            const {getters} = segmentationModule;
            const viewport = eventData.viewport;
            const context = eventData.canvasContext;
            const element = eventData.element;
            let mouseStartPosition, mouseEndPosition;
            let width, height;

            mouseEndPosition = this._lastImageCoords;
            mouseStartPosition = this.startCoords;
            context.strokeStyle = "rgba(0,255,0)";

            width = Math.abs(mouseStartPosition.x - mouseEndPosition.x) * viewport.scale;
            height = Math.abs(mouseStartPosition.y - mouseEndPosition.y) * viewport.scale;

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

            const startCoordsCanvas = window.cornerstone.pixelToCanvas(
                element,
                mouseStartPosition,
            );

            context.ellipse(
                startCoordsCanvas.x,
                startCoordsCanvas.y,
                width,
                height,
                0,
                0,
                2 * Math.PI,
            );

            context.stroke();
            this.ellipseWidth = width;
            this.ellipseHeight = height;
            this._lastImageCoords = eventData.image;
        }
    }

}

function generateEllipse(mouseStartPosition, width, height, n) {
    let points = [];
    let x, y;

    for (let i = 0; i < n; i++) {
        x = Math.floor(mouseStartPosition.x + Math.floor(Math.cos(2 * Math.PI / n * i) * (width / 2)));
        y = Math.floor(mouseStartPosition.y + Math.floor(Math.sin(2 * Math.PI / n * i) * (height / 2)));
        points.push([x, y]);
    }

    return points;
}
