/**
 * React Static Boilerplate
 * https://github.com/kriasoft/react-static-boilerplate
 *
 * Copyright © 2015-present Kriasoft, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React from 'react';
import store from './store';
import { creators } from './actions';
import category from '../data/queries/category.txt';
import menuLocation from '../data/queries/menu_location.txt';
import page from '../data/queries/page.txt';
import posts from '../data/queries/posts.txt';
import getData from './data';

const queries = {
  category,
  menuLocation,
  page,
  posts,
};

function decodeParam(val) {
  if (!(typeof val === 'string' || val.length === 0)) {
    return val;
  }

  try {
    return decodeURIComponent(val);
  } catch (err) {
    if (err instanceof URIError) {
      err.message = `Failed to decode param '${val}'`;
      err.status = 400;
    }

    throw err;
  }
}

// Match the provided URL path pattern to an actual URI string. For example:
//   matchURI({ path: '/posts/:id' }, '/dummy') => null
//   matchURI({ path: '/posts/:id' }, '/posts/123') => { id: 123 }
function matchURI(route, path) {
  const match = route.pattern.exec(path);

  if (!match) {
    return null;
  }

  const params = Object.create(null);

  for (let i = 1; i < match.length; i += 1) {
    params[route.keys[i - 1].name] = match[i] !== undefined ? decodeParam(match[i]) : undefined;
  }

  return params;
}

function matchParams(query, params) {
  const pattern = /[a-z]+(\(.*\))\w*/;
  console.log({ query });
  const newQuery = query.replace(pattern, '(id: 7)');
  console.log({ newQuery, params });
}

// Find the route matching the specified location (context), fetch the required data,
// instantiate and return a React component
function resolve(routes, context) {
  for (const route of routes) { // eslint-disable-line no-restricted-syntax
    const params = matchURI(route, context.error ? '/error' : context.pathname);

    if (!params) {
      continue; // eslint-disable-line no-continue
    }

    if (route.graphql) {
      const keys = Object.keys(route.graphql);

      return Promise.all([
        route.load(),
        (() => {
          const query = keys.map(key => queries[key]).join(',');
          const all = matchParams(query, params);
          console.log({ all });

          return getData(`{${query}}`);
        })(),
      ]).then(([Page, data]) => {
        store.dispatch(creators.updateData(data.data));
        return <Page route={{ ...route, params }} error={context.error} />;
      });
    }

    // Check if the route has any data requirements, for example:
    // { path: '/tasks/:id', data: { task: 'GET /api/tasks/$id' }, page: './pages/task' }
    if (route.data) {
      // Load page component and all required data in parallel
      const keys = Object.keys(route.data);
      return Promise.all([
        route.load(),
        ...keys.map((key) => {
          const query = route.data[key];
          const method = query.substring(0, query.indexOf(' ')); // GET
          const contentType = 'application/json';
          let url = query.substr(query.indexOf(' ') + 1);      // /api/tasks/$id
          // TODO: Optimize
          Object.keys(params).forEach((k) => {
            url = url.replace(`${k}`, params[k]);
          });
          return fetch(url, { method, contentType }).then(resp => resp.json());
        }),
      ]).then(([Page, ...data]) => {
        const props = keys.reduce((result, key, i) => ({ ...result, [key]: data[i] }), {});
        return <Page route={{ ...route, params }} error={context.error} {...props} />;
      });
    }

    return route.load().then(Page => <Page route={{ ...route, params }} error={context.error} />);
  }

  const error = new Error('Page not found');
  error.status = 404;
  return Promise.reject(error);
}

export default { resolve };
