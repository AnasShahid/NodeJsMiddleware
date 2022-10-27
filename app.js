const express = require('express');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
require('dotenv').config();
const app = express();

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const { PORT, HOST } = process.env;
const { BASE_URL, JSESSIONID, XSRF_TOKEN } = process.env;

// Logging the requests
app.use(morgan('dev'));

// ================ Node JS Middlewares =======================

/**
 * Middleware 1
 * Set the response headers for Access control. 
 */
app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Request methods you wish to allow
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS, PUT, PATCH, DELETE'
  );

  // Request headers you wish to allow
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-Requested-With,content-type,Authorization'
  );

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Pass to next layer of middleware
  next();
});

/**
 * Middleware 2
 * Set OK status for all options / preflight requests
 * Return OK status without validating the authorization token
 */
app.options('/*', (_, res) => {
  res.sendStatus(200);
});

/**
 * Middleware 3
 * Check if the authorization header is present else send unauthorized response
 */
app.use('', (req, res, next) => {
  if (req.headers.authorization) {
    next();
  } else {
    res.status(403).send('Authorization header is not present in the request.');
  }
});

/**
 * Actual Middleware logic that intercepts the APIs starting with /myTeamsApi and re-writing the URL, request and response headers
 */
app.use(
  '/myTeamsApi',
  createProxyMiddleware({
    target: BASE_URL,
    changeOrigin: true,
    secure: false,
    logLevel: 'debug',
    pathRewrite: {
      [`^/myTeamsApi`]: '',
    },
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader('Cookie', getcookieValue(proxyReq));
    },
    onProxyRes: (proxyRes, req, res) => {
      proxyRes.headers['access-control-allow-origin'] = '*';
    },
  })
);

// ======= Testing methods ================================

app.get('/masterdata', async (req, res, next) => {
  try {
    let apiResponse = await axios.get(`${BASE_URL}/getMasterData`, {
      headers: getRequestHeaders(req),
    });
    if (apiResponse.status >= 200 && apiResponse.status < 300) {
      res.send(apiResponse.data);
    } else {
      res.status(apiResponse.status).send([]);
    }
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

app.get('/info', (req, res, next) => {
  console.log(req.headers);
  res.send('This is a proxy server for calling the backend APIs');
});

// =============== End Testing Methods =============================



//=============== Helper Methods ==================================

const getRequestHeaders = (req) => {
  return {
    Cookie: getcookieValue(req),
  };
};
const getcookieValue = (req) => {
  //const authCookie = `JSESSIONID=${JSESSIONID};XSRF-TOKEN=${XSRF_TOKEN}`;
  const authCookie =
    req?.headers?.authorization || req.getHeader?.('authorization');
  return authCookie;
};

//============== End Helper Methods ========================================

app.listen(PORT, () => {
  console.log(`Starting the server at ${PORT}`);
});
