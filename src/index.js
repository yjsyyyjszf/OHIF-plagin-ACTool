import csTools from "cornerstone-tools";
import cornestone from "cornerstone-core";
import debounce from 'lodash/debounce';

import {KASS} from "./KASS"
import {GVF} from "./GVF";

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

            var gvf = new GVF({
                maxIteration: 100,
                minlen: 3,
                maxlen: 6,
                image: this.pixelArray2D,
                width: this.w,
                height: this.h,
                dots: [...this.point],
                //threshold: 80,

                render(snake, i, iLength, finished) {
                    console.log(snake);
                }
            });

            gvf.compute();
        }, 1000);


    }

    preMouseDownCallback(evt) {

        const eventData = evt.detail;
        const {rows, columns} = eventData.image;
        const imageData = eventData.image.getPixelData();

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
        //нормализовать или нет значения в грейскайл, пока зависит от алгоритма

        this.pixelArray2D = get2DArray(grayScale, rows, columns);
        this.w = columns;
        this.h = rows;
        let mousePosition = eventData.currentPoints.image;
        let radius = 30;
        this.point = getCircle(radius, rows, columns, mousePosition.x.valueOf(), mousePosition.y.valueOf());

        //Kass
        this.doActiveContour(evt);

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


/*
разобраться с масштабом (ближе к отрисовке контуров)

GVF - значения нормируются, в kass нет
рефакторинг кода после завершения каждого этапа

// initial points побыстрее инициализирует окружность
double radius = ((W)/2 + (H)/2) / 2;
double perimeter = 6.28 * radius*0.6;
int nmb = (int) (perimeter / MAXLEN);
Point[] circle = new Point[nmb];
for (int i = 0; i < circle.length; i++) {
    double x = (W / 2 + 0) + (W / 2 - 2) * Math.cos((6.28 * i) / circle.length);
    double y = (H / 2 + 0) + (H / 2 - 2) * Math.sin((6.28 * i) / circle.length);
    circle[i] = new Point((int) x, (int) y);
}

//настройка параметров очень сильно отражается на результате (прям иногда может быть идеальный результат)
*/

