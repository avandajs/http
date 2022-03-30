"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const validate_1 = __importDefault(require("../middleware/validate"));
require("reflect-metadata");
function default_1(props) {
    props.immediate = typeof props.immediate == 'undefined' ? true : !!props.immediate;
    return function (target, propertyKey, descriptor) {
        // target.watched[''];
        // descriptor.
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            var _a, _b;
            let request = args[1];
            let response = args[0];
            //check middleware first
            let middlewareCheck = await (0, validate_1.default)(props.middlewares, response, request);
            if (middlewareCheck !== null) {
                return function (...args) {
                    return middlewareCheck;
                };
            }
            const watchedMetadataKey = request.id + ":watched";
            let key = propertyKey;
            let resFunc = props.immediate ? originalMethod(...args) : response.success("");
            resFunc.responseChanged = false;
            let prev = Reflect.getOwnMetadata(watchedMetadataKey, target, key) || {
                value: null,
                firstCall: true,
                changed: true,
                response: resFunc,
                reqData: JSON.stringify((_a = request.data) !== null && _a !== void 0 ? _a : '')
            };
            //check for middlewares validity
            let reqData = JSON.stringify((_b = request.data) !== null && _b !== void 0 ? _b : '');
            let forceNewRes = prev.reqData !== reqData;
            let responseToShow = forceNewRes ? originalMethod(...args) : prev.response;
            // get watchable function
            let watching = JSON.stringify(await props.watch(request));
            let somethingChanged = false;
            if (((prev.firstCall && props.immediate) || prev.value !== watching) && !forceNewRes) {
                console.log("Something changed>>>>>>>");
                // console.log({prevData: prev.value})
                // console.log({watching})
                responseToShow = await originalMethod.apply(this, args);
                prev.changed = true;
            }
            else {
                prev.changed = false;
            }
            props.immediate = false;
            prev.firstCall = false;
            prev.reqData = reqData;
            responseToShow.responseChanged = false;
            //ignore next line
            prev.value = watching;
            prev.response = responseToShow;
            responseToShow.responseChanged = prev.changed;
            Reflect.defineMetadata(watchedMetadataKey, prev, target, key);
            return responseToShow;
        };
        return descriptor;
    };
}
exports.default = default_1;
