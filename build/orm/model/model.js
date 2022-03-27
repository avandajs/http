"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var sequelize_1 = require("sequelize");
var lodash_1 = require("lodash");
var error_1 = require("@avanda/error");
var app_1 = require("@avanda/app");
var moment_1 = __importDefault(require("moment"));
/*
* I know i should have a seperate class for query to make building query easier and more nestable,
* I think that's a future
* */
var Model = /** @class */ (function () {
    function Model() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.perPage = 10;
        this.totalRows = 0;
        this.totalRecords = 0;
        this.orders = [];
        this.nextedWhereDone = false;
        this.connection = (0, app_1.Connection)({
            dbDialect: app_1.Env.get('DB_DRIVER', 'mysql'),
            dbName: app_1.Env.get('DB_NAME'),
            dbPassword: app_1.Env.get('DB_PASSWORD'),
            dbUser: app_1.Env.get('DB_USER', 'root')
        });
    }
    Model.prototype.setPerPage = function (perPage) {
        this.perPage = perPage;
        return this;
    };
    Model.prototype.setModelName = function (value) {
        this.modelName = value;
    };
    Model.prototype.getPropertyTypes = function (origin) {
        var _this = this;
        var properties = Reflect.getMetadata(origin.constructor.name, origin);
        var result = {};
        properties.forEach(function (prop) {
            var options = prop.options;
            options.dataType.value = _this[prop.name];
            result[prop.name] = options;
        });
        return result;
    };
    // query builder wrapper start here
    Model.prototype.select = function () {
        var columns = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            columns[_i] = arguments[_i];
        }
        if (columns.length == 1 && columns[0] == "")
            return this;
        this.tempSelectColumn = columns[columns.length - 1];
        this.columns = columns;
        return this;
    };
    Model.prototype.sum = function (column) {
        this.tempSelectColumn = (0, sequelize_1.fn)('SUM', (0, sequelize_1.col)(column));
        return this;
    };
    Model.prototype.as = function (alias) {
        if (!this.tempSelectColumn)
            throw new error_1.runtimeError("'You haven't specified the expression to assign alias for");
        this.columns.push([this.tempSelectColumn, alias]);
        return this;
    };
    Model.prototype.where = function (condition) {
        return this._where(condition, sequelize_1.Op.and);
    };
    Model.prototype.whereRaw = function (condition) {
        return this._where(condition, sequelize_1.Op.and, true);
    };
    Model.prototype.orWhere = function (condition) {
        return this._where(condition, sequelize_1.Op.or);
    };
    Model.prototype.closeQuery = function () {
        if (this.logicalOp && this.nextedWhereDone && this.whereClauses && this.tempClauses) {
            //    wrap the last one up
            this.whereClauses[this.logicalOp] = __spreadArray(__spreadArray([], this.whereClauses[this.logicalOp], true), [this.tempClauses], false);
            this.nextedWhereDone = false;
            this.logicalOp = undefined;
            this.tempClauses = undefined;
            this.tempColumn = undefined;
        }
    };
    Model.convertRawToArray = function (query) {
        var _a, _b, _c;
        ///[^\w\s]/
        var operators = {
            '>': sequelize_1.Op.gt,
            '<': sequelize_1.Op.lt,
            '=': sequelize_1.Op.eq,
            'not': sequelize_1.Op.not,
            'is': sequelize_1.Op.is,
            '!=': sequelize_1.Op.ne,
            '>=': sequelize_1.Op.gte,
            '<=': sequelize_1.Op.lte,
            'like': sequelize_1.Op.like,
            'not like': sequelize_1.Op.notLike,
        };
        var aliases = {
            'null': null
        };
        var tokens = /(\w+)\s+([^\w\s]+|not|is|LIKE|NOT\s+LIKE)\s+(.+)/i.exec(query);
        if (!tokens)
            return {};
        // console.log({tokens})
        var operator = tokens[2];
        var key = tokens[1];
        var value = tokens[3];
        var ret = {};
        if (operator in operators) {
            ret = (_a = {}, _a[key] = (_b = {}, _b[operators[operator]] = value in aliases ? aliases[value] : value, _b), _a);
        }
        else {
            ret = (_c = {}, _c[key] = value in aliases ? aliases[value] : value, _c);
        }
        // console.log({ret})
        return ret;
    };
    Model.prototype._where = function (condition, operand, isRaw) {
        if (operand === void 0) { operand = sequelize_1.Op.and; }
        if (isRaw === void 0) { isRaw = false; }
        this.closeQuery();
        if (typeof condition == 'function') {
            this.logicalOp = operand;
            condition(this);
            this.nextedWhereDone = true;
        }
        else if (typeof condition == 'object') {
            this.updateWhereClauses(operand, condition);
        }
        else if (typeof condition == 'string' && isRaw) {
            this.updateWhereClauses(operand, Model.convertRawToArray(condition));
        }
        else {
            this.tempColumn = condition;
        }
        return this;
    };
    Model.prototype.updateWhereClauses = function (operand, condition) {
        var _a, _b;
        var _c;
        if (this.whereClauses && operand == sequelize_1.Op.or && typeof ((_c = this.whereClauses) === null || _c === void 0 ? void 0 : _c.hasOwnProperty(sequelize_1.Op.and))) {
            this.whereClauses = (_a = {},
                _a[operand] = __spreadArray([], this.whereClauses[sequelize_1.Op.and], true),
                _a);
        }
        if (!this.whereClauses) {
            this.whereClauses = (_b = {},
                _b[operand] = [],
                _b);
        }
        if (!this.whereClauses[operand])
            this.whereClauses[operand] = [];
        if (this.logicalOp) {
            this.tempClauses = __assign(__assign({}, this.tempClauses), condition);
            return null;
        }
        if (!this.logicalOp && this.tempClauses) {
            condition = __assign(__assign({}, condition), this.tempClauses);
        }
        if (!this.logicalOp) {
            this.whereClauses[operand] = __spreadArray(__spreadArray([], this.whereClauses[operand], true), [condition], false);
        }
        if (this.logicalOp) {
            // console.log(this.tempClauses)
        }
        return condition;
    };
    Model.prototype.ofId = function (id) {
        // @ts-ignore
        this.where({ id: id });
        return this;
    };
    Model.prototype.ofUserId = function (id) {
        // @ts-ignore
        this.where({ user_id: id });
        return this;
    };
    Model.prototype.greaterThan = function (value) {
        if (!this.tempColumn)
            throw new error_1.runtimeError("Specify column to apply greaterThan() to user the where() function");
        this.whereRaw(this.tempColumn + " > " + value);
        return this;
    };
    Model.prototype.find = function (id) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.closeQuery();
                        return [4 /*yield*/, this.queryDb('findOne', {
                                id: id
                            })];
                    case 1: return [2 /*return*/, (_a = (_b.sent())) !== null && _a !== void 0 ? _a : null];
                }
            });
        });
    };
    Model.prototype.findAll = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.queryDb('findAll', {
                            id: id
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Model.prototype.queryDb = function (fn, where, fields) {
        var _a, _b, _c;
        if (where === void 0) { where = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var instance, page, offset, limit, result;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1:
                        instance = _d.sent();
                        page = this.currentPage - 1;
                        offset = this.perPage * page;
                        limit = this.perPage;
                        return [4 /*yield*/, instance[fn]({
                                where: __assign(__assign({}, this.whereClauses), where),
                                attributes: this.columns,
                                order: this.orders,
                                limit: limit,
                                offset: offset
                            })];
                    case 2:
                        result = _d.sent();
                        this.totalRows = (_b = (_a = result === null || result === void 0 ? void 0 : result.count) !== null && _a !== void 0 ? _a : result === null || result === void 0 ? void 0 : result.length) !== null && _b !== void 0 ? _b : 0;
                        // console.log({total: this.totalRows})
                        this.totalRecords = this.totalRows;
                        this.totalPages = Math.ceil(this.totalRows / this.perPage);
                        // console.log({totalPages: this.totalPages})
                        return [2 /*return*/, (_c = result === null || result === void 0 ? void 0 : result.rows) !== null && _c !== void 0 ? _c : result];
                }
            });
        });
    };
    Model.prototype.findBy = function (col, value) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.queryDb('findOne', (_a = {},
                            _a[col] = value,
                            _a))];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    Model.prototype.findAllBy = function (col, value) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.queryDb('findAll', (_a = {},
                            _a[col] = value,
                            _a))];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    Model.prototype.first = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.closeQuery();
                        this.orders.push(['id', 'ASC']);
                        return [4 /*yield*/, this.queryDb('findOne')];
                    case 1: return [2 /*return*/, (_a = _b.sent()) !== null && _a !== void 0 ? _a : null];
                }
            });
        });
    };
    Model.prototype.last = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.closeQuery();
                        this.orders.push(['id', 'DESC']);
                        return [4 /*yield*/, this.queryDb('findOne')];
                    case 1: return [2 /*return*/, (_a = _b.sent()) !== null && _a !== void 0 ? _a : null];
                }
            });
        });
    };
    Model.prototype.orderBy = function (column, order) {
        if (order === void 0) { order = 'DESC'; }
        this.orders.push([column, order]);
        return this;
    };
    Model.prototype.all = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.closeQuery();
                        return [4 /*yield*/, this.queryDb('findAll')];
                    case 1: return [2 /*return*/, (_a = _b.sent()) !== null && _a !== void 0 ? _a : []];
                }
            });
        });
    };
    // query builder wrapper ends here
    Model.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.initInstance)
                            return [2 /*return*/, this.initInstance];
                        _a = this;
                        return [4 /*yield*/, this.convertToSequelize()];
                    case 1:
                        _a.initInstance = _b.sent();
                        return [2 /*return*/, this.initInstance];
                }
            });
        });
    };
    Model.prototype.convertToSequelize = function () {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function () {
            var _f, structure, props, _loop_1, this_1, _g, _h, _i, prop, that;
            var _this = this;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        _f = this;
                        return [4 /*yield*/, this.connection];
                    case 1:
                        _f.sequelize = _j.sent();
                        structure = {};
                        props = this.getPropertyTypes(this);
                        _loop_1 = function (prop) {
                            var value, type, _k, _l, _m, _o;
                            var _p, _q;
                            return __generator(this, function (_r) {
                                switch (_r.label) {
                                    case 0:
                                        value = props[prop];
                                        type = (_a = value === null || value === void 0 ? void 0 : value.dataType) === null || _a === void 0 ? void 0 : _a.getType();
                                        if (!type)
                                            return [2 /*return*/, "continue"];
                                        if (value.references)
                                            value.references.sequelize = this_1.sequelize;
                                        _k = structure;
                                        _l = prop;
                                        _m = [__assign(__assign({ type: type, unique: value.unique ? value.unique : undefined, comment: value.comment, defaultValue: (_b = value === null || value === void 0 ? void 0 : value.dataType) === null || _b === void 0 ? void 0 : _b.value, allowNull: typeof value.nullable == 'undefined' ? false : value.nullable }, (value.onDeleted && { onDelete: value.onDeleted })), (value.onUpdated && { onUpdated: value.onUpdated }))];
                                        _o = value.references;
                                        if (!_o) return [3 /*break*/, 2];
                                        _p = {};
                                        _q = {};
                                        return [4 /*yield*/, ((_c = value.references) === null || _c === void 0 ? void 0 : _c.init())];
                                    case 1:
                                        _o = (_p.references = (_q.model = _r.sent(),
                                            _q.key = 'id',
                                            _q),
                                            _p);
                                        _r.label = 2;
                                    case 2:
                                        _k[_l] = __assign.apply(void 0, [__assign.apply(void 0, [__assign.apply(void 0, _m.concat([(_o)])), (((_d = value === null || value === void 0 ? void 0 : value.dataType) === null || _d === void 0 ? void 0 : _d.getter) && {
                                                    get: function () {
                                                        var _a, _b;
                                                        var rawValue = this.getDataValue(prop);
                                                        return (_b = (_a = value === null || value === void 0 ? void 0 : value.dataType) === null || _a === void 0 ? void 0 : _a.getter) === null || _b === void 0 ? void 0 : _b.call(_a, rawValue);
                                                    }
                                                })]), (((_e = value === null || value === void 0 ? void 0 : value.dataType) === null || _e === void 0 ? void 0 : _e.setter) && {
                                                set: function (val) {
                                                    var _a, _b;
                                                    return __awaiter(this, void 0, void 0, function () {
                                                        var newValue;
                                                        return __generator(this, function (_c) {
                                                            switch (_c.label) {
                                                                case 0: return [4 /*yield*/, ((_b = (_a = value === null || value === void 0 ? void 0 : value.dataType) === null || _a === void 0 ? void 0 : _a.setter) === null || _b === void 0 ? void 0 : _b.call(_a, val))];
                                                                case 1:
                                                                    newValue = _c.sent();
                                                                    this.setDataValue('password', newValue);
                                                                    return [2 /*return*/];
                                                            }
                                                        });
                                                    });
                                                }
                                            })]);
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _g = [];
                        for (_h in props)
                            _g.push(_h);
                        _i = 0;
                        _j.label = 2;
                    case 2:
                        if (!(_i < _g.length)) return [3 /*break*/, 5];
                        prop = _g[_i];
                        return [5 /*yield**/, _loop_1(prop)];
                    case 3:
                        _j.sent();
                        _j.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        // console.log(structure)
                        if (!this.sequelize)
                            this.sequelize = new sequelize_1.Sequelize();
                        that = this;
                        return [2 /*return*/, this.sequelize.define(this.modelName || this.constructor.name, structure, {
                                tableName: (0, lodash_1.snakeCase)(this.modelName || this.constructor.name),
                                omitNull: false,
                                hooks: {
                                    beforeCreate: function (model) { return __awaiter(_this, void 0, void 0, function () {
                                        var gl, newData;
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0: return [4 /*yield*/, this.override(this.getOnlyPropsFromInstance())];
                                                case 1:
                                                    gl = _a.sent();
                                                    return [4 /*yield*/, this.overrideInsert(this.getOnlyPropsFromInstance())];
                                                case 2:
                                                    newData = _a.sent();
                                                    model.set(__assign(__assign({}, gl), newData));
                                                    return [2 /*return*/];
                                            }
                                        });
                                    }); },
                                    beforeUpdate: function (model) { return __awaiter(_this, void 0, void 0, function () {
                                        var gl, newData;
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0: return [4 /*yield*/, this.override(this.getOnlyPropsFromInstance())];
                                                case 1:
                                                    gl = _a.sent();
                                                    return [4 /*yield*/, this.overrideUpdate(this.getOnlyPropsFromInstance())];
                                                case 2:
                                                    newData = _a.sent();
                                                    model.set(__assign(__assign({}, gl), newData));
                                                    return [2 /*return*/];
                                            }
                                        });
                                    }); }
                                }
                                // Other model options go here
                            })];
                }
            });
        });
    };
    Model.prototype.whereColIsNull = function (column) {
        this.whereRaw(column + " is null");
        return this;
    };
    Model.prototype.whereNotUpdatedSince = function (count, unit) {
        var _a, _b;
        if (unit === void 0) { unit = 'days'; }
        this.updateWhereClauses(sequelize_1.Op.and, (_a = {},
            _a['updatedAt'] = (_b = {},
                _b[sequelize_1.Op.lt] = (0, moment_1.default)().subtract(count, unit).toDate(),
                _b),
            _a));
        return this;
    };
    Model.prototype.whereHasExpired = function () {
        var _a, _b;
        this.updateWhereClauses(sequelize_1.Op.and, (_a = {},
            _a['expiresOn'] = (_b = {},
                _b[sequelize_1.Op.lte] = new Date(),
                _b),
            _a));
        return this;
    };
    Model.prototype.whereHasNotExpired = function () {
        var _a, _b;
        this.updateWhereClauses(sequelize_1.Op.and, (_a = {},
            _a['expiresOn'] = (_b = {},
                _b[sequelize_1.Op.gt] = new Date(),
                _b),
            _a));
        return this;
    };
    Model.prototype.whereNotCreatedSince = function (count, unit) {
        var _a, _b;
        if (unit === void 0) { unit = 'days'; }
        this.updateWhereClauses(sequelize_1.Op.and, (_a = {},
            _a['createdAt'] = (_b = {},
                _b[sequelize_1.Op.lt] = (0, moment_1.default)().subtract(count, unit).toDate(),
                _b),
            _a));
        return this;
    };
    Model.prototype.whereColIn = function (column, values) {
        var _a, _b;
        this.updateWhereClauses(sequelize_1.Op.and, (_a = {},
            _a[column] = (_b = {},
                _b[sequelize_1.Op.in] = values,
                _b),
            _a));
        return this;
    };
    Model.prototype.whereColIsNotNull = function (column) {
        this.whereRaw(column + " not null");
        return this;
    };
    Model.prototype.whereColumns = function () {
        var column = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            column[_i] = arguments[_i];
        }
        return this;
    };
    Model.prototype.matches = function (value) {
        return this;
    };
    Model.prototype.like = function (keyword) {
        if (!this.tempColumn)
            throw new error_1.runtimeError("Chain like() method with where(column: string)");
        this.whereRaw(this.tempColumn + " like " + keyword);
        return this;
    };
    Model.prototype.notLike = function (keyword) {
        if (!this.tempColumn)
            throw new error_1.runtimeError("Chain notLike() method with where(column: string)");
        this.whereRaw(this.tempColumn + " not like " + keyword);
        return this;
    };
    Model.prototype.getOnlyPropsFromInstance = function () {
        var _this = this;
        var props = this.getPropertyTypes(this);
        Object.keys(props).map(function (key) {
            if (_this[key])
                props[key] = _this[key];
            else
                delete props[key];
        });
        return props;
    };
    //    Writing
    Model.prototype.save = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1: return [4 /*yield*/, (_a.sent()).create(this.getOnlyPropsFromInstance())];
                    case 2: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    Model.prototype.truncate = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1: return [4 /*yield*/, (_a.sent()).destroy({
                            truncate: true
                        })];
                    case 2: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    Model.prototype.delete = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1: return [4 /*yield*/, (_a.sent()).destroy({
                            where: this.whereClauses
                        })];
                    case 2: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    Model.prototype.update = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1: return [4 /*yield*/, (_a.sent()).update(data, {
                            where: this.whereClauses
                        })];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Model.prototype.increment = function (column, by) {
        if (by === void 0) { by = 1; }
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1: return [4 /*yield*/, (_b.sent()).increment((_a = {}, _a[column] = by, _a), {
                            where: this.whereClauses
                        })];
                    case 2: return [2 /*return*/, (_b.sent())];
                }
            });
        });
    };
    Model.prototype.decrement = function (column, by) {
        if (by === void 0) { by = 1; }
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1: return [4 /*yield*/, (_b.sent()).increment((_a = {}, _a[column] = -by, _a), {
                            where: this.whereClauses
                        })];
                    case 2: return [2 /*return*/, (_b.sent())];
                }
            });
        });
    };
    Model.prototype.page = function (num) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.currentPage = num;
                        this.closeQuery();
                        return [4 /*yield*/, this.queryDb('findAndCountAll')];
                    case 1: return [2 /*return*/, (_a = _b.sent()) !== null && _a !== void 0 ? _a : []];
                }
            });
        });
    };
    Model.prototype.create = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1: return [4 /*yield*/, (_a.sent()).create(data)];
                    case 2: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    Model.prototype.createBulk = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1: return [4 /*yield*/, (_a.sent()).bulkCreate(data)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Model.prototype.overrideInsert = function (data) {
        return {};
    };
    Model.prototype.overrideUpdate = function (data) {
        return {};
    };
    Model.prototype.override = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {}];
            });
        });
    };
    return Model;
}());
exports.default = Model;
