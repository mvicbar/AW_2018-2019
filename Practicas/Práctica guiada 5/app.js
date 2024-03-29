"use strict";
const config = require("./config");
const DAOTasks = require("./DAOTasks");
const DAOUsers = require("./DAOUsers");
const path = require("path");
const mysql = require("mysql");
const express = require("express");
const bodyParser = require("body-parser");
const createTask = require("./P0.js");
const mysqlSession = require("express-mysql-session");
const session = require("express-session");

// Crear un servidor Express.js
const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public", "views"));


//MYSQL SESSION
const MySQLStore = mysqlSession(session);

const sessionStore = new MySQLStore({
    host: config.mysqlConfig.host,
    user: config.mysqlConfig.user,
    password: config.mysqlConfig.password,
    database: config.mysqlConfig.database
});

//Crear el middlewareSession
const middlewareSession = session({
    saveUninitialized: false,
    secret: "foobar34",
    resave: false,
    store: sessionStore
});


// Crear un pool de conexiones a la base de datos de MySQL
const pool = mysql.createPool(config.mysqlConfig);


// Crear una instancia de DAOTasks y de DAOUsers
const daoT = new DAOTasks(pool);
const daoU = new DAOUsers(pool);


//  Ficheros estáticos
const ficherosEstaticos = path.join(__dirname, "public");
app.use(express.static(ficherosEstaticos));


app.use(middlewareSession);


//  Entrada en el sistema
app.get("/login", function(request, response){
    response.status(200);
    response.render("login", {errorMsg : null});
});


//  Salida del sistema
app.get("/logout", middlewareLogin,
function(request, response){
    response.status(200);
    request.session.destroy();
    response.redirect("/login");
});


//  Listado de tareas
app.get("/tasks",  middlewareLogin,
function (request, response) {
    daoT.getAllTasks(response.locals.userEmail, function (error, tareas) {
        if (error) {
            response.status(500);
        }
        else {
            response.status(200);
            response.render("tasks", { taskList: tareas, userEmail: response.locals.userEmail});
        }
    });

});


app.use(bodyParser.urlencoded({ extended: true }));

//  Añadir la tarea a la lista de tareas
app.post("/addTask", middlewareLogin,
function (request, response) {

    let cuerpo = request.body.Tarea_añadida;
    let task = createTask(cuerpo);

    daoT.insertTask(response.locals.userEmail, task, function (error) {
        if (error) {
            if (error.message === "Empty task") {
                response.status(200);
                response.redirect("/tasks");
            }
            else {
                response.status(500);
            }
        }
        else {
            response.status(200);
            response.redirect("/tasks");
        }
    });
});


//  Entrada en el sistema
app.post("/login", function (request, response) {
        let user = {
            email: "",
            password: ""
        }
        user.email = request.body.email_user;
        user.password = request.body.password_user;
        
        daoU.isUserCorrect(user.email, user.password, function(error, res){
            if(error){
                response.render("login", {errorMsg : "Error"});
            }
            else if(res){
                response.status(200);
                request.session.currentUser = user.email;
                response.redirect("/tasks");
            }
            else{
                response.render("login", {errorMsg : "Dirección de correo y/o contraseña no válidos "});
            }
        });
});


//  Imagen del usuario
app.get("/imagenUsuario", middlewareLogin,
    function(request, response){
    daoU.getUserImageName(response.locals.userEmail, function(error, userImg){
        if(error){
            response.status(500);
        }else if(userImg){
            response.status(200);
            response.sendFile(path.join(__dirname, "profile_imgs", userImg));
        }else{
            response.sendFile(path.join(__dirname, "public", "img", "NoPerfil.jpg"));
        }
    });
});     


//  Marcar tarea como finalizada
app.get("/finish/:taskId", middlewareLogin,
function (request, response) {
   
    daoT.markTaskDone(request.params.taskId, function (error) {
        if (error) {
            response.status(500);
        }
        else {
            response.status(200);
            response.redirect("/tasks");
        }
    });
});


//  Eliminar tareas marcadas
app.get("/deleteCompleted", middlewareLogin,
function (request, response) {
    daoT.deleteCompleted(response.locals.userEmail, function (error) {
        if (error) {
            response.status(500);
        }
        else {
            response.status(200);
            response.redirect("/tasks");
        }
    });
});


// Arrancar el servidor
app.listen(config.port, function (err) {
    if (err) {
        console.log("ERROR al iniciar el servidor");
    }
    else {
        console.log(`Servidor arrancado en el puerto ${config.port}`);
    }
});

function middlewareLogin(request, response, next){
    if(request.session.currentUser!==undefined){
        response.locals.userEmail=request.session.currentUser;
        next();
    }
    else{
        response.redirect("/login");
    }
}