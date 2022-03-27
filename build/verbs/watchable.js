"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const validate_1 = __importDefault(require("../middleware/validate"));
require("reflect-metadata");
const watchedMetadataKey = Symbol("watched");
function default_1(props) {
    props.immediate = typeof props.immediate == 'undefined' ? true : props.immediate;
    return function (target, propertyKey, descriptor) {
        // target.watched[''];
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            let request = args[1];
            let response = args[0];
            let resFunc = props.immediate ? originalMethod(...args) : response.success("");
            resFunc.responseChanged = false;
            let prev = Reflect.getOwnMetadata(watchedMetadataKey, target, propertyKey) || {
                value: null,
                firstCall: true,
                changed: true,
                response: resFunc
            };
            //check for middlewares validity
            let middlewareCheck = await (0, validate_1.default)(props.middlewares, response, request);
            if (middlewareCheck !== null) {
                return function (...args) {
                    return middlewareCheck;
                };
            }
            let responseToShow = prev.response;
            // get watchable function
            let watching = JSON.stringify(await props.watch(request));
            let somethingChanged = false;
            if ((prev.firstCall && props.immediate) || prev.value !== watching) {
                console.log("Something changed>>>>>>>");
                // console.log({prevData: prev.value})
                // console.log({watching})
                responseToShow = await originalMethod.apply(this, args);
                prev.changed = true;
            }
            else {
                prev.changed = false;
            }
            prev.firstCall = false;
            props.immediate = true;
            responseToShow.responseChanged = false;
            //ignore next line
            prev.value = watching;
            prev.response = responseToShow;
            responseToShow.responseChanged = prev.changed;
            console.log({ responseToShowMutated: responseToShow, changed: prev.changed });
            Reflect.defineMetadata(watchedMetadataKey, prev, target, propertyKey);
            return responseToShow;
        };
        return descriptor;
    };
}
exports.default = default_1;
