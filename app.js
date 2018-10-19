/** Express app for Lunchly. */

const express = require("express");
const nunjucks = require("nunjucks");
const bodyParser = require("body-parser");
const routes = require("./routes");

const app = express();

app.use(bodyParser.urlencoded({extended: false}));

nunjucks.configure('templates', {
  autoescape: true,
  express: app,
});

app.use(routes);


module.exports = app;
