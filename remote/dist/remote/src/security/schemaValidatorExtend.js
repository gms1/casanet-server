"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Joi = require("joi");
exports.LoginLocalServerSchema = Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().not('').required(),
    localServerId: Joi.string().allow(''),
}).required();
const initSchema = Joi.object().keys({
    macAddress: Joi.string().not('').length(12).required(),
    remoteAuthKey: Joi.string().not('').required(),
});
const localUsersSchema = Joi.object().keys({
    users: Joi.array().items(Joi.string().email()).required(),
    requestId: Joi.string().not('').required(),
});
const httpResponseSchema = Joi.object().keys({
    requestId: Joi.string().not('').required(),
    httpStatus: Joi.number().integer().required(),
    httpBody: Joi.any(),
    httpSession: Joi.object().keys({
        key: Joi.string().not('').required(),
        maxAge: Joi.number().required(),
    }),
});
const emptyMessageSchema = Joi.object().keys({});
const feedSchema = Joi.object().keys({
    feedType: Joi.valid('minions', 'timings').required(),
    feedContent: Joi.any().required(),
});
exports.LocalMessageSchema = Joi.object().keys({
    localMessagesType: Joi.valid('initialization', 'localUsers', 'httpResponse', 'ack', 'feed').required(),
    message: Joi.alternatives()
        .when('localMessagesType', {
        is: 'initialization',
        then: Joi.object().keys({ initialization: initSchema.required() }).required(),
    })
        .when('localMessagesType', {
        is: 'localUsers',
        then: Joi.object().keys({ localUsers: localUsersSchema.required() }).required(),
    })
        .when('localMessagesType', {
        is: 'httpResponse',
        then: Joi.object().keys({ httpResponse: httpResponseSchema.required() }).required(),
    })
        .when('localMessagesType', {
        is: 'ack',
        then: emptyMessageSchema.required(),
    })
        .when('localMessagesType', {
        is: 'feed',
        then: Joi.object().keys({ feed: feedSchema.required() }).required(),
    }),
}).required();
//# sourceMappingURL=schemaValidatorExtend.js.map