import csTools from "cornerstone-tools";
import cornestone from "cornerstone-core";
import debounce from 'lodash/debounce';

import {mean} from "mathjs";
import {ChamferDistance} from "./ChamferDistance"
import {KASS} from "./KASS"

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


        this.doActiveContour = debounce(evt => {

            var acm = new KASS({
                maxIteration: 100,
                minlen: 3,
                maxlen: 6,

                gradient: this.gradient,
                flow: this.flow,
                width: this.w,
                height: this.h,
                dots: [...this.point],

                render(snake, i, iLength, finished) {
                    console.log(snake);
                }
            });

            acm.compute();
        }, 1000);


    }

    preMouseDownCallback(evt) {

        const eventData = evt.detail;
        const {rows, columns} = eventData.image;
        const imageData = eventData.image.getPixelData();

        let threshold;

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
                    Math.round((value / eventData.image.maxPixelValue) * 255) //TODO find max_value вроде есть бит в структуре максимального значения
                );
                break;
            default:
                grayScale = pixelArray;
        }

        //TODO разобраться как преобразовать снимки маммографии к grayscale
        //TODO нормализовать или нет значения в грейскайл, пока заисит от алгоритма
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

        //console.log(channelGradient);

        //threshold mean
        threshold = mean(channelGradient); //может будет настраиваемым параметром
        //console.log(threshold);

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

        //console.log(binarygradient);

        //ChamferDistance
        let dist = ChamferDistance.compute(ChamferDistance.chamfer13, binarygradient, columns, rows);
        //console.log(dist);

        //channelFlow
        let channelFlow = init2DArray(rows, columns);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                channelFlow[x][y] = Math.floor(dist[x][y])
            }
        }

        this.w = columns;
        this.h = rows;
        this.gradient = binarygradient;
        this.flow = dist;
        let mousePosition = eventData.currentPoints.image;
        let radius = 30;
        this.point = getCircle(radius, rows, columns, mousePosition.x.valueOf(), mousePosition.y.valueOf());

        //Kass
        this.doActiveContour(evt);

        /*
       разобраться с масштабом
        //render circle's contour radius = r
        let mousePosition = eventData.currentPoints.image;
        let radius = 30;
        const circleArray = getCircle(radius, rows, columns, mousePosition.x.valueOf(), mousePosition.y.valueOf());

        GVF - значения нормируются, в kass нет
        рефакторинг кода после завершения каждого этапа

        // initial points
        double radius = ((W)/2 + (H)/2) / 2;
        double perimeter = 6.28 * radius*0.6;
        int nmb = (int) (perimeter / MAXLEN);
        Point[] circle = new Point[nmb];
        for (int i = 0; i < circle.length; i++) {
            double x = (W / 2 + 0) + (W / 2 - 2) * Math.cos((6.28 * i) / circle.length);
            double y = (H / 2 + 0) + (H / 2 - 2) * Math.sin((6.28 * i) / circle.length);
            circle[i] = new Point((int) x, (int) y);
        }

        вынести часто используемые функции
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


