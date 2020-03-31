import csTools from "cornerstone-tools";
import cornestone from "cornerstone-core";

const {drawBrushPixels} = csTools.importInternal(
    'util/segmentationUtils'
);
const segmentationModule = csTools.getModule('segmentation');
const BaseBrushTool = csTools.importInternal("base/BaseBrushTool");

export default class ACTool extends BaseBrushTool {
    constructor(props = {}) {
        const defaultProps = {
            name: 'ACTool',
            supportedInteractionTypes: ['Mouse', 'Touch'],
            //configuration: {},
        };

        super(props, defaultProps);
        this.preMouseDownCallback = this.preMouseDownCallback.bind(this);
        this._drawingMouseUpCallback = this._drawingMouseUpCallback.bind(this);
        this.renderBrush = this.renderBrush.bind(this);
        this.mouseDragCallback = this.mouseDragCallback.bind(this);
        this._paint = this._paint.bind(this);

    }

    preMouseDownCallback(evt) {

        // Lock switching images when rendering data
        csTools.setToolDisabled('StackScrollMouseWheel', {});

        const eventData = evt.detail;
        const {element, currentPoints} = eventData;

        //init

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

        //для начала вывести массив точек
        console.log(this.initPoints); //для произвольного контура и окружности
        /*
        //нарисовать через drawBrush
        //
        const element = evt.detail.element;
        const {getters} = segmentationModule;

        const {
            labelmap2D,
            labelmap3D,
            currentImageIdIndex,
            activeLabelmapIndex,
        } = getters.labelmap2D(element);

        //const shouldErase =
        //   super._isCtrlDown(evt.detail) || this.configuration.alwaysEraseOnClick;
        /*
        this.paintEventData = {
            labelmap2D,
            labelmap3D,
            currentImageIdIndex,
            activeLabelmapIndex,
            shouldErase,
        };
         */

        //const {labelmap2D, labelmap3D} = this.paintEventData;
/*
        drawBrushPixels(
            this.initPoints,
            labelmap2D.pixelData,
            labelmap3D.activeSegmentIndex,
            evt.detail.image.columns,
            false
        );

        cornerstone.updateImage(element);
        */
        //animation
        //segmentation
        //csTools.setToolActive('StackScrollMouseWheel', {});
        //return null;
    }

    renderBrush(evt) {
        //убрать повторы кода
        this.initPoints = [];
        /* произвольный контур
                if (this._drawing) {

                    this.initPoints = [];
                    const eventData = evt.detail;
                    const viewport = eventData.viewport;//
                    const context = eventData.canvasContext;
                    const element = eventData.element;
                    let mouseEndPosition, mouseStartPosition;

                    mouseStartPosition = this.startCoords;
                    mouseEndPosition = this._lastImageCoords;

                    context.strokeStyle = "rgb(0,255,0)";
                    context.setTransform(1, 0, 0, 1, 0, 0);

                    const startCoordsCanvas = window.cornerstone.pixelToCanvas(
                        element,
                        mouseStartPosition,
                    );

                    context.moveTo(startCoordsCanvas.x,startCoordsCanvas.y);
                    context.beginPath();
                    let endCoordsCanvas = window.cornerstone.pixelToCanvas(
                        element,
                        mouseEndPosition,
                    );
                    context.lineTo(endCoordsCanvas.x,endCoordsCanvas.y);
                    context.closePath();
                    context.stroke();

                    this._lastImageCoords = eventData.image;


                }*/
        //контур-окружность
        if (this._drawing) {
            //запоминать центр, ширину,высоту, потом просто генерить точки, но надо количество
            const eventData = evt.detail;
            const {getters} = segmentationModule;
            const viewport = eventData.viewport;
            const context = eventData.canvasContext;
            const element = eventData.element;
            let mouseStartPosition, mouseEndPosition;
            let width, height;

            mouseEndPosition = this._lastImageCoords; //end ellipse point
            mouseStartPosition = this.startCoords; //start ellipse point

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
            //наверное, разумней генерировать один раз уже прямо в _paint, здесь только запоминать + проблемы с масштабом
            this.initPoints = generateEllipse(mouseStartPosition, width, height, 100);//number of points - как определять?
            this._lastImageCoords = eventData.image;
        } else {

            //cursor
            const eventData = evt.detail;
            const viewport = eventData.viewport;
            const context = eventData.canvasContext;
            const element = eventData.element;
            let mousePosition;
            let width;


            mousePosition = csTools.store.state.mousePositionImage;
            const radius = 1;
            width = radius * viewport.scale;
            context.strokeStyle = "rgb(0,255,0)";
            context.fillStyle = "rgb(0,255,0)";


            if (!mousePosition) {
                return;
            }

            const {rows, columns} = eventData.image;
            const {x, y} = mousePosition;

            if (x < 0 || x > columns || y < 0 || y > rows) {
                return;
            }

            context.setTransform(1, 0, 0, 1, 0, 0);

            context.beginPath();

            const mouseCoords = window.cornerstone.pixelToCanvas(
                element,
                mousePosition,
            );

            context.ellipse(
                mouseCoords.x,
                mouseCoords.y,
                width,
                width,
                0,
                0,
                2 * Math.PI,
            );

            context.stroke();
            context.fill();

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
