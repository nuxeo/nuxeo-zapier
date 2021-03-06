/*
 * (C) Copyright 2018 Nuxeo SA (http://nuxeo.com/).
 * This is unpublished proprietary source code of Nuxeo SA. All rights reserved.
 * Notice of copyright on this source code does not indicate publication.
 *
 * Contributors:
 *     Nuxeo
 */
const hydrators = require('../hydrators');
const subscribeHook = (z, bundle) => {
  const data = {
    url: bundle.targetUrl,
    resolver: bundle.inputData.notification,
    requiredFields: getRequiredFields(bundle.inputData),
  };
  const options = {
    url: `${bundle.authData.url}/nuxeo/site/hook`,
    method: 'POST',
    body: JSON.stringify(data),
  };
  return z.request(options)
    .then((response) => JSON.parse(response.content));
};

const getRequiredFields = (inputData) => {
  delete inputData.notification;
  return inputData;
};

const unsubscribeHook = (z, bundle) => {
  const hookId = bundle.subscribeData.id;
  const options = {
    url: `${bundle.authData.url}/nuxeo/site/hook/${hookId}`,
    method: 'DELETE',
  };
  return z.request(options)
    .then((response) => JSON.parse(response.content));
};

const getNotifications = (z, bundle) => {
  const notification = bundle.cleanedRequest;
  if ('binary' in notification[0]) {
    notification[0].binary = z.dehydrate(hydrators.downloadFile, {
      url: notification[0].binary,
    });
  }
  return notification;
};

const triggerNotificationWebHook = (z, bundle) => {
  const request = {
    headers: {
      'Content-Type': 'application/json',
    },
    url: `${bundle.authData.url}/nuxeo/site/hook/example?${getQueryListParams('schemas', bundle.inputData.schemas)}`,
  };
  return z.request(request).then((response) => {
    return z.JSON.parse(response.content);
  });
};

const getQueryListParams = (id, list) => {
  let params = '';
  list.forEach((entry) => {
    params += `${id}=${entry}&`;
  });
  return params;
};

const fetchDescription = (z, resolverId, bundle) => {
  return z.request(getRequest(bundle, resolverId)).then((response) => {
    return JSON.parse(response.content).description;
  });
};

const fetchResolver = (z, resolverId, bundle) => {
  return z.request(getRequest(bundle, resolverId)).then((response) => {
    return JSON.parse(response.content).requiredFields;
  });
};

const getRequest = (bundle, notificationId) => {
  return {
    headers: {
      'Content-Type': 'application/json',
    },
    url: `${bundle.authData.url}/nuxeo/api/v1/notification/resolver/${notificationId}`,
    params: {},
  }
};

module.exports = {
  key: 'webHook',
  noun: 'Notifications WebHook',

  display: {
    label: 'Get Nuxeo Notifications',
    description: 'Choose and get all kind of Nuxeo Notifications',
  },

  operation: {
    type: 'hook',

    inputFields: [
      // Resolver
      function (z, bundle) {
        const request = {
          url: `${bundle.authData.url}/nuxeo/api/v1/notification/resolver`,
          params: {},
        };
        return z.request(request).then((response) => {
          const resolvers = JSON.parse(response.content).entries;
          let result = {};
          result.key = 'notification';
          result.helpText = 'Choose the notification';
          result.choices = {};
          result.required = true;
          result.altersDynamicFields = true;
          resolvers.forEach((resolver) => {
            result.choices[resolver.id] = resolver.label;
          });
          return result;
        });
      },
      // Resolver Description (display only)
      function (z, bundle) {
        const resolverId = bundle.inputData.notification;
        if (resolverId) {
          return fetchDescription(z, resolverId, bundle).then((description) => {
            if (description && description !== '') {
              let result = {};
              result.key = 'description';
              result.helpText = description;
              result.type = 'copy';
              return [result];
            }
            return [];
          });
        }
        return [];
      },
      // Resolver required fields
      function (z, bundle) {
        const resolverId = bundle.inputData.notification;
        if (resolverId) {
          return fetchResolver(z, resolverId, bundle).then((requiredFields) => {
            let results = [];
            if (requiredFields) {
              requiredFields.forEach((requiredField) => {
                let result = {};
                result.key = requiredField;
                result.label = requiredField;
                result.required = true;
                results.push(result);
              });
              return results;
            }
            return [];
          });
        }
        return [];
      },
      // Schemas to fetch from the sample
      function (z, bundle) {
        const request = {
          url: `${bundle.authData.url}/nuxeo/api/v1/config/schemas`,
          params: {},
        };
        return z.request(request).then((response) => {
          const schemas = JSON.parse(response.content);
          let entries = {};
          entries.key = 'schemas';
          entries.label = 'Schemas';
          entries.helpText = 'Choose schema(s) to map for the next template';
          entries.choices = {};
          entries.list = true;
          entries.default = 'dublincore';
          schemas.forEach((schema) => {
            entries.choices[schema.name] = schema.name;
          });
          return entries;
        });
      },
    ],

    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,

    perform: getNotifications,
    performList: triggerNotificationWebHook,
  },
};
