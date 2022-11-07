var jwt = require('jsonwebtoken');

const JWT_SECRET = 'MyTeamsSecurityKey';
const createAuthToken = (tokensObj) => {
  return jwt.sign(
    {
      JSESSIONID: tokensObj.SessionId,
      XSRF_TOKEN: tokensObj.XsrfToken,
    },
    JWT_SECRET,
    {
      expiresIn: '24h',
    }
  );
};

const getcookieValue = (req) => {
  const authCookie =
    req?.headers?.authorization || req.getHeader?.('authorization');
  return authCookie;
};

const prepareCookieFromTokens = ({ JSESSIONID, XSRF_TOKEN }) => {
  return `JSESSIONID=${JSESSIONID};XSRF-TOKEN=${XSRF_TOKEN}`;
};

const login = (req, res, next) => {
  try {
    console.log(req.body)
    const { SessionId, XsrfToken } = req.body;
    if (!(SessionId && XsrfToken)) {
      return res.status(400).send('Tokens are required');
    }
    const token = createAuthToken({ SessionId, XsrfToken });
    res.status(200).send({token});
  } catch (e) {
    console.error(e);
  }
};

const authenticate = (req, res, next) => {
  if (req.headers.authorization) {
    req.authCookie = getcookieValue(req);
    next();
  } else {
    res.status(403).send('Authorization header is not present in the request.');
  }
};

const authenticateViaToken = (req, res, next) => {
  const token = req.headers['x-access-token'] || req.headers.authorization;

  if (!token) {
    return res.status(403).send('Authorization token not found');
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.authCookie = prepareCookieFromTokens(decoded);
    req.xsrfToken = decoded["XSRF_TOKEN"];
  } catch (err) {
    console.error(err);
    return res.status(401).send(err.message);
  }
  return next();
};

module.exports = {
  authenticate,
  login,
  authenticateViaToken,
};
