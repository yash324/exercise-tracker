const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI)

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


const Schema = mongoose.Schema;

const exerciseSchema = new Schema({
    description: {type: String, required: true},
    duration: {type: Number, required: true},
    date: {type: Date}                                    
});

const userSchema = new Schema({
    username: {type: String, unique: true, required: true},
    exercises: [exerciseSchema]
});

const User = mongoose.model('User', userSchema);

app.post('/api/exercise/new-user', async (req, res, next) => {
  
  let user = await User.findOne({username: req.body.username});
  if(!user){
        user = new User({username: req.body.username, exercises: []});  
        user = await user.save();
        return res.json({username: user.username, _id: user._id});
  }
  else {
    next(new Error("Username already taken"));
  }
});

app.get('/api/exercise/users', async (req, res) => {
   let users = await User.find();
   res.json(users.map(user => ({username: user.username, _id: user._id})));
});

app.post('/api/exercise/add', async (req, res, next) => {
 let user = User.findById(req.body.userId, async (err, user) => {
      if(err || !user)
        return next(new Error("Invalid UserId"));
      let exercise = {
        description: req.body.description,
        duration: parseInt(req.body.duration),
        date: new Date(req.body.date)
      }
      user.exercises = [...user.exercises, exercise];
      try{
        user = await user.save();
        return res.json({
          _id: user._id,
          username: user.username, 
          description: exercise.description, 
          duration: exercise.duration, 
          date: exercise.date.toString().slice(0,15)
        });
      } catch(e){
        return next(e);
      }
    });
});

app.get('/api/exercise/log', async (req, res, next) => {
  
  let user = User.findById(req.query.userId, async (err, user) => {
      if(err || !user)
        return next(new Error("Invalid UserId"));
      let { exercises } = user;
      
      
      if(req.query.from)
        if(/\d{4}-\d{2}-\d{2}/.test(req.query.from))
          exercises = exercises.filter(exercises => exercises.date >= new Date(req.query.from));  
        else
          return next(new Error("Invalid from value. Please use yyyy-mm-dd"));
        
      if(req.query.to)
        if(/\d{4}-\d{2}-\d{2}/.test(req.query.to))
          exercises = exercises.filter(exercises => exercises.date <= new Date(req.query.to));
        else
          return next(new Error("Invalid to value. Please use yyyy-mm-dd"));
      
      let limit = req.query.limit || user.exercises.length;
      if(parseInt(limit) >= 0)
        exercises = exercises.slice(0, limit);
      else
        return next(new Error("Invalid limit value. Please use integer values only"));
    
      exercises = exercises.map(exercise => ({
          description: exercise.description,
          duration: exercise.duration,
          date: exercise.date.toString().slice(0,15)
        }));
      return res.json({
        _id: user._id, 
        username: user.username,
        count: exercises.length,
        log: exercises
      });
    }); 
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
