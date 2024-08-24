const http = require('http');
const finalHandler = require('finalhandler');
const queryString = require('querystring');
const url = require('url');
const Router = require('router');
const bodyParser = require('body-parser');
const fs = require('fs');

// State holding variables
let goals = [];
let user = {};
let users = [];
let categories = [];

// Setup router
let myRouter = Router();
myRouter.use(bodyParser.json());

// Helper functions
const filterByQuery = (query, filterSource) => {
  return filterSource.filter((goal) => {
    return goal.description.toLowerCase().includes(query.toLowerCase())
  });
}

// This function is a bit simpler...
http.createServer(function (request, response) {
  myRouter(request, response, finalHandler(request, response))
}).listen(3001, () => {
  // Load dummy data into server memory for serving
  goals = JSON.parse(fs.readFileSync("goals.json","utf-8"));
  
  // Load all users into users array and for now hardcode the first user to be "logged in"
  users = JSON.parse(fs.readFileSync("users.json","utf-8"));
  user = users[0];
  
  // Load all categories from file
  categories = JSON.parse(fs.readFileSync("categories.json","utf-8"));
});

// Notice how much cleaner these endpoint handlers are...
myRouter.get('/v1/goals', function(request,response) {
  // Get our query params from the query string
  const queryParams = queryString.parse(url.parse(request.url).query)

  let respData = goals;

  // TODO: Do something with the query params
  if (queryParams.query) {
    const query = queryParams.query;
    respData  = filterByQuery(query, goals);
  };

  if (queryParams.sort) {
    const sortType = queryParams.sort;
    switch (sortType) {
      case "upVotes":
        respData.sort((cur, prev) => {
         return prev.upVotes - cur.upVotes;
        })
        break
      case "dateCreated":
        respData.sort((cur, prev) => {
          return  new Date(prev.dateCreated) - new Date(cur.dateCreated)
        })
        break
    }
  };


  // Return all our current goal definitions (for now)
  return response.end(JSON.stringify(respData));
});

// See how i'm not having to build up the raw data in the body... body parser just gives me the whole thing as an object.
// See how the router automatically handled the path value and extracted the value for me to use?  How nice!
myRouter.post('/v1/me/goals/:goalId/accept', function(request,response) {
  // Find goal from id in url in list of goals
  let goal = goals.find((goal)=> {
    return goal.id == request.params.goalId
  })
  // Add it to our logged in user's accepted goals
  user.acceptedGoals.push(goal); 
  // No response needed other than a 200 success
  return response.end();
});

myRouter.post('/v1/me/goals/:goalId/challenge/:userId', function(request,response) {
  // Find goal from id in url in list of goals
  let goal = goals.find((goal)=> {
    return goal.id == request.params.goalId
  })
  // Find the user who is being challenged in our list of users
  let challengedUser = users.find((user)=> {
    return user.id == request.params.userId
  })
  // Make sure the data being changed is valid
  if (!goal) {
    response.statusCode = 400
    return response.end("No goal with that ID found.")
  }
  // Add the goal to the challenged user
  challengedUser.challengedGoals.push(goal); 
  // No response needed other than a 200 success
  return response.end();
});