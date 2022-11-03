const express = require('express');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const {
  authenticate,
  login,
  authenticateViaToken,
} = require('./auth.controller');
require('dotenv').config();
const app = express();
app.use(express.json());

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const PORT = process.env.PORT || 3030;
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
  return res.sendStatus(200);
});

//============== Middleware and endpoints =========================

app.post('/login', login);

/**
 * Actual Middleware logic that intercepts the APIs starting with /myTeamsApi and re-writing the URL, request and response headers
 */
app.use(
  '/myTeamsApi',
  authenticateViaToken,
  createProxyMiddleware({
    target: BASE_URL,
    changeOrigin: true,
    secure: false,
    logLevel: 'debug',
    pathRewrite: {
      [`^/myTeamsApi`]: '',
    },
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader('Cookie', req.authCookie);
      proxyReq.setHeader('X-XSRF-TOKEN',req.xsrfToken);
    },
    onProxyRes: (proxyRes, req, res) => {
      proxyRes.headers['access-control-allow-origin'] = '*';
      if(proxyRes.statusCode == 302 && proxyRes.headers.location?.toLocaleLowerCase()?.includes("myteam/saml")){ 
        // the case where the request is being transferred to identity provider for re-login, we have to return unauthorized response
        proxyRes.statusCode = 401;
        proxyRes.statusMessage = "Unauthorized";
      }
    },
  })
);

// ======= Testing methods ================================

app.get('/masterdata', authenticate, async (req, res, next) => {
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

app.get('/info', authenticateViaToken, (req, res, next) => {
  console.log(req.authToken);
  res.send('This is a proxy server for calling the backend APIs');
});

// =============== End Testing Methods =============================

//=============== Helper Methods ==================================

const getRequestHeaders = (req) => {
  return {
    Cookie: req.authCookie,
  };
};

//============== End Helper Methods ========================================

app.listen(PORT, () => {
  console.log(`Starting the server at ${PORT}`);
});
