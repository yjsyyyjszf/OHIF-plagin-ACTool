import csTools from "cornerstone-tools";
import cornestone from "cornerstone-core";

import {mean} from "mathjs";

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

        let threshold = 0;

        const generalSeriesModuleMeta = cornerstone.metaData.get(
            'generalSeriesModule',
            eventData.image.imageId
        );

        //grayscale 8-bit
        let grayScale;

        switch (generalSeriesModuleMeta.modality) {
            case 'CT':
                grayScale = imageData.map(value =>
                    Math.round(((value + 2048) / 4096) * 255)
                );
                break;
            case 'MR':
                grayScale = imageData.map(value =>
                    Math.round((value / eventData.image.maxPixelValue) * 255) //TODO find max_value вроде есть бит в структуре
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
                let p00 = pixelArray2D[y][x];//
                let p10 = pixelArray2D[y + 1][x];
                let p20 = pixelArray2D[y + 2][x];
                let p01 = pixelArray2D[y][x + 1];
                let p21 = pixelArray2D[y + 2][x + 1];
                let p02 = pixelArray2D[y][x + 2];
                let p12 = pixelArray2D[y + 1][x + 2];
                let p22 = pixelArray2D[y + 2][x + 2];
                let sx = (p20 + 2 * p21 + p22) - (p00 + 2 * p01 + p02);
                let sy = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p10);
                let snorm = Math.floor(Math.sqrt(sx * sx + sy * sy));
                channelGradient[y + 1][x + 1] = snorm;
                maxgradient = Math.max(maxgradient, snorm);
            }
        }


        //threshold mean
        threshold = mean(channelGradient);
        console.log(threshold);

        //thresholding
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


        //console.log(channelGradient);
        /*
                function avg(data){
                    let sum = 0;
                    for(let i=0;i<data.length;i++){
                        for(let j=0;i<data[i].length;j++){
                            sum= sum + data[i][j];
                        }
                    }
                    return sum;//
                }

                console.log(avg(channelGradient)/(columns*rows));//
                //!strange coef? threshold * maxgradient / 100
                threshold = mean
        */
        //console.log(binarygradient);
        //Chamfer Dist
        //algorithm


        // !данные не нормализованы относительно 255
        /*
        //render circle's contour radius = r
        let mousePosition = eventData.currentPoints.image;
        let radius = 50;
        const circleArray = getCircle(radius, rows, columns, mousePosition.x.valueOf(), mousePosition.y.valueOf());


        let ex_data = [];

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                ex_data[rows * y + x] = channelGradient[y][x];
            }
        }
        ;
        вопросы с индексами и порог

        //
        const canvas = document.getElementsByClassName(
            'cornerstone-canvas'
        )[0];
        const canvasContext = canvas.getContext('2d');
        let data = canvasContext.getImageData(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                let id = (y * rows + x) * 4;
                data[id] = data[id + 1] = data[id + 2] = binarygradient[y][x] === 1 ? 255 : 0;
                data[id + 3] = 0xFF;
            }
        }
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);
        canvasContext.putImageData(data, 0, 0);
        GVF - значения нормируются, в kass нет
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


