"use strict";

function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
const R = require('ramda');
const _require = require('@parse/node-apn'),
  ApnsMessage = _require.Notification;
const _require2 = require('node-gcm'),
  GcmMessage = _require2.Message;
const _require3 = require('../constants'),
  DEFAULT_TTL = _require3.DEFAULT_TTL,
  GCM_MAX_TTL = _require3.GCM_MAX_TTL;
const ttlFromExpiry = R.compose(R.min(GCM_MAX_TTL), R.max(0), expiry => expiry - Math.floor(Date.now() / 1000));
const extractTimeToLive = R.cond([[R.propIs(Number, 'expiry'), ({
  expiry
}) => ttlFromExpiry(expiry)], [R.propIs(Number, 'timeToLive'), R.prop('timeToLive')], [R.T, R.always(DEFAULT_TTL)]]);
const expiryFromTtl = ttl => ttl + Math.floor(Date.now() / 1000);
const extractExpiry = R.cond([[R.propIs(Number, 'expiry'), R.prop('expiry')], [R.propIs(Number, 'timeToLive'), ({
  timeToLive
}) => expiryFromTtl(timeToLive)], [R.T, () => expiryFromTtl(DEFAULT_TTL)]]);
const getPropValueOrUndefinedIfIsSilent = (propName, data) => {
  if (data.silent) {
    return undefined;
  }
  return data[propName];
};
const toJSONorUndefined = R.when(R.is(String), R.tryCatch(JSON.parse, R.always(undefined)));
const alertLocArgsToJSON = R.evolve({
  alert: {
    'title-loc-args': toJSONorUndefined,
    'loc-args': toJSONorUndefined
  }
});
const getDefaultAlert = data => ({
  title: data.title,
  body: data.body,
  'title-loc-key': data.titleLocKey,
  'title-loc-args': data.titleLocArgs,
  'loc-key': data.locKey,
  'loc-args': data.locArgs || data.bodyLocArgs,
  'launch-image': data.launchImage,
  action: data.action
});
const alertOrDefault = data => R.when(R.propSatisfies(R.isNil, 'alert'), R.assoc('alert', getDefaultAlert(data)));
const getParsedAlertOrDefault = data => R.pipe(alertOrDefault(data), alertLocArgsToJSON)(data);
const pathIsString = R.pathSatisfies(R.is(String));
const containsValidRecipients = R.either(pathIsString(['recipients', 'to']), pathIsString(['recipients', 'condition']));
const buildGcmNotification = data => {
  const notification = data.fcm_notification || {
    title: data.title,
    body: data.body,
    icon: data.icon,
    image: data.image,
    picture: data.picture,
    style: data.style,
    sound: data.sound,
    badge: data.badge,
    tag: data.tag,
    color: data.color,
    click_action: data.clickAction || data.category,
    body_loc_key: data.locKey,
    body_loc_args: toJSONorUndefined(data.locArgs),
    title_loc_key: data.titleLocKey,
    title_loc_args: toJSONorUndefined(data.titleLocArgs),
    android_channel_id: data.android_channel_id,
    notification_count: data.notificationCount || data.badge
  };
  return notification;
};
const buildGcmMessage = (data, options) => {
  const notification = buildGcmNotification(data);
  let custom;
  if (typeof data.custom === 'string') {
    custom = {
      message: data.custom
    };
  } else if (typeof data.custom === 'object') {
    custom = _objectSpread({}, data.custom);
  } else {
    custom = {
      data: data.custom
    };
  }
  custom.title = custom.title || data.title;
  custom.message = custom.message || data.body;
  custom.sound = custom.sound || data.sound;
  custom.icon = custom.icon || data.icon;
  custom.msgcnt = custom.msgcnt || data.badge;
  if (options.phonegap === true && data.contentAvailable) {
    custom['content-available'] = 1;
  }
  const message = new GcmMessage({
    collapseKey: data.collapseKey,
    priority: data.priority === 'normal' ? 'normal' : 'high',
    contentAvailable: data.silent ? true : data.contentAvailable || false,
    delayWhileIdle: data.delayWhileIdle || false,
    timeToLive: extractTimeToLive(data),
    restrictedPackageName: data.restrictedPackageName,
    dryRun: data.dryRun || false,
    data: options.phonegap === true ? Object.assign(custom, notification) : custom,
    notification: options.phonegap === true || data.silent === true ? undefined : notification
  });
  return message;
};
const buildApnsMessage = data => {
  const message = new ApnsMessage({
    retryLimit: data.retries || -1,
    expiry: extractExpiry(data),
    priority: data.priority === 'normal' || data.silent === true ? 5 : 10,
    encoding: data.encoding,
    payload: data.custom || {},
    badge: getPropValueOrUndefinedIfIsSilent('badge', data),
    sound: getPropValueOrUndefinedIfIsSilent('sound', data),
    alert: getPropValueOrUndefinedIfIsSilent('alert', getParsedAlertOrDefault(data)),
    topic: data.topic,
    category: data.category || data.clickAction,
    contentAvailable: data.contentAvailable,
    mdm: data.mdm,
    urlArgs: data.urlArgs,
    truncateAtWordEnd: data.truncateAtWordEnd,
    collapseId: data.collapseKey,
    mutableContent: data.mutableContent || 0,
    threadId: data.threadId,
    pushType: data.pushType,
    interruptionLevel: data.interruptionLevel
  });
  if (data.rawPayload) {
    message.rawPayload = data.rawPayload;
  }
  return message;
};
module.exports = {
  ttlAndroid: extractTimeToLive,
  apnsExpiry: extractExpiry,
  containsValidRecipients,
  buildApnsMessage,
  buildGcmMessage
};