import csTools from "cornerstone-tools";
import cornestone from "cornerstone-core";

const BaseTool = csTools.importInternal("base/BaseTool");

export default class ACTool extends BaseTool {
    constructor(props = {}) {
        const defaultProps = {
            name: 'ACTool',
            supportedInteractionTypes: ['Mouse', 'Touch'],
            configuration: {},
        };

        super(props, defaultProps);

        this.preMouseDownCallback = this.preMouseDownCallback.bind(this);

    }

    preMouseDownCallback(evt) {

        const eventData = evt.detail;
        const {rows, columns} = eventData.image;
        const imageData = eventData.image.getPixelData();

        const threshold = 0.3;

        const generalSeriesModuleMeta = cornerstone.metaData.get(
            'generalSeriesModule',
            eventData.image.imageId
        );

        //grayscale 8-bit
        let grayScale;

        switch (generalSeriesModuleMeta.modality) {
            case 'CT':
                grayScale = imageData.map(value =>
                    Math.round(((value + 2048) / 4096) * 256)
                );
                break;
            case 'MR':
                grayScale = imageData.map(value =>
                    Math.round((value / eventData.image.maxPixelValue) * 256)
                );
                break;
            default:
                grayScale = pixelArray;
        }

        //console.log(grayScale);

        let pixelArray2D = get2DArray(grayScale, rows, columns);

        //Sobel
        let channelGradient = init2DArray(rows, columns);

        let maxgradient = 0;
        for (let y = 0; y < rows - 2; y++) {
            for (let x = 0; x < columns - 2; x++) {
                let p00 = pixelArray2D[x][y];
                let p10 = pixelArray2D[x + 1][y];
                let p20 = pixelArray2D[x + 2][y];
                let p01 = pixelArray2D[x][y + 1];
                let p21 = pixelArray2D[x + 2][y + 1];
                let p02 = pixelArray2D[x][y + 2];
                let p12 = pixelArray2D[x + 1][y + 2];
                let p22 = pixelArray2D[x + 2][y + 2];
                let sx = (p20 + 2 * p21 + p22) - (p00 + 2 * p01 + p02);
                let sy = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p10);
                let snorm = Math.floor(Math.sqrt(sx * sx + sy * sy));
                channelGradient[x + 1][y + 1] = snorm;
                maxgradient = Math.max(maxgradient, snorm);
            }
        }

        //console.log(channelGradient);

        //thresholding
        let binarygradient = init2DArray(rows, columns);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                if (channelGradient[x][y] > threshold * maxgradient / 100) { //strange coef?
                    binarygradient[x][y] = 1;
                } else {
                    channelGradient[x][y] = 0;
                }
            }
        }

        //console.log(binarygradient);

        /*
        //render circle's contour radius = r
        let mousePosition = eventData.currentPoints.image;
        let radius = 50;
        const circleArray = getCircle(radius, rows, columns, mousePosition.x.valueOf(), mousePosition.y.valueOf());


       const canvas = document.getElementsByClassName(
           'cornerstone-canvas'
       )[0];
       const canvasContext = canvas.getContext('2d');
       canvasContext.clearRect(0, 0, canvas.width, canvas.height);
       canvasContext.drawImage(grayScale, 0, 0);
*/

    }


}

function getCircle(
    radius,
    rows,
    columns,
    xCoord = 0,
    yCoord = 0
) {
    const x0 = Math.floor(xCoord);
    const y0 = Math.floor(yCoord);

    if (radius === 1) {
        return [[x0, y0]];
    }

    const circleArray = [];
    let index = 0;

    for (let y = -radius; y <= radius; y++) {
        const yCoord = y0 + y;

        if (yCoord > rows || yCoord < 0) {
            continue;
        }

        for (let x = -radius; x <= radius; x++) {
            const xCoord = x0 + x;

            if (xCoord >= columns || xCoord < 0) {
                continue;
            }

            if (x * x + y * y === radius * radius) {
                circleArray[index++] = [x0 + x, y0 + y];
            }
        }
    }

    return circleArray;
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
