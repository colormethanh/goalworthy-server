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
myRouter.get('/v1/goals', function (request,response) {
  // TODO: Do something with the query params
  try {
    // Get our query params from the query string
    const queryParams = queryString.parse(url.parse(request.url).query)
    let respData = {status: 200, data: goals};
    if (queryParams.query) {
      const query = queryParams.query;
      respData.data = filterByQuery(query, goals);
    };
  
    if (queryParams.sort) {
      const sortType = queryParams.sort;
      switch (sortType) {
        case "upVotes":
          respData.data.sort((cur, prev) => {
           return prev.upVotes - cur.upVotes;
          })
          break
        case "dateCreated":
          respData.data.sort((cur, prev) => {
            return  new Date(prev.dateCreated) - new Date(cur.dateCreated);
          })
          break
      }
    };
    // Return requested goals
    response.statusCode = 200;
    return response.end(JSON.stringify(respData));
  } catch (err) {
     console.log(err)
     response.statusCode = 500;
     return response.end(JSON.stringify({status: 500, data: "Server error"}))
  }

});

// Get categories
myRouter.get('/v1/categories', function (request, response) {
  try {
    return response.end(JSON.stringify({"status": 200, "data" : categories}));
  } catch (err) {
    response.statusCode = 500;
    return response.end(JSON.stringify({"status": 500, "data": "Server error"}));
  }
})

// Get goals in specific category
myRouter.get('/v1/categories/:id/goals', function (request, response) {
  
  try {
    let filteredGoals = goals.filter((goal) => {
      console.log(request.queryParams);
      return goal.categoryId == request.params.id;
    });

    return response.end(JSON.stringify({"status": 200, data: filteredGoals}));
  } catch(err) {
    console.log(err)
    response.statusCode = 500;
    return response.end(JSON.stringify({"status": 500, data: err}))
  }
})

// Get user data 
myRouter.get('/v1/me', function (request, response) {
  const respData = {}
  try {
    if (!user) {
      return response.end(JSON.stringify({status: 400, data: "User could not be found"}))
    }
    respData.data = user;
    respData.status = 200;
    return response.end(JSON.stringify(respData));
  } catch (err) {
    response.statusCode = 500;
    return response.end(JSON.stringify({status: 500, data: "Server error"}))
  }
})

// Accept a goal
myRouter.post('/v1/me/goals/:goalId/accept', function (request,response) {
  // Find goal from id in url in list of goals
  let goal = goals.find((goal)=> {
    return goal.id == request.params.goalId
  });

  if (!goal) {
    response.statusCode = 400;
    return response.end(JSON.stringify({"status": 400, "data": "Goal could not be found"}));
  }

  try {
    // Add goal to our logged in user's accepted goals
    user.acceptedGoals.push(goal); 
    
    // update the goals file
    // fs.writeFile("users.json", JSON.stringify(users), () => {
    //   users = JSON.parse(fs.readFileSync("users.json","utf-8"));
    //   user = users[0];
    //   // No response needed other than a 200 success
    //   return response.end(JSON.stringify({"status": 200, "data": "success"}));
    // });
    return response.end(JSON.stringify({"status": 200, "data": "success"}));
  } catch (err) {
    console.log(err)
    response.statusCode = 500;
    return response.end(JSON.stringify({"status": 500, "data": "server error"}))
  }
});

// Achieve a goal
myRouter.post('/v1/me/goals/:goalId/achieve', function (request, response){
  // get goal from user
  const goal = user.acceptedGoals.find((goal) => {return goal.id == request.params.goalId}); 
  if (!goal) {
    response.statusCode = 400
    return response.end(JSON.stringify({"status": 400, "data": "Goal could not be found"}));
  }

  // add goal to achieved goals
  try {
    // update the goals file
    user.achievedGoals.push(goal);
    // fs.writeFile("users.json", JSON.stringify(users), () => {
    //   users = JSON.parse(fs.readFileSync("users.json","utf-8"));
    //   user = users[0];   
    //   return response.end(JSON.stringify({"status": 200, "data": "success"}));
    // });
    return response.end(JSON.stringify({"status": 200, "data": "success"}));
  } catch (err) {
    console.log(err)
    response.statusCode = 500;
    return response.end(JSON.stringify({"status": 500, "data": "server error"}))
  }
})

// Challenge another user
myRouter.post('/v1/me/goals/:goalId/challenge/:userId', function (request,response) {

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
    response.statusCode = 400;
    return response.end("No goal with that ID found.");
  }
  // Add the goal to the challenged user
  challengedUser.challengedGoals.push(goal); 
  // No response needed other than a 200 success
  return response.end();
});

// Gift a goal 
myRouter.post('/v1/me/goals/:id/gift/:userId', function (request, response) {
  let goal = goals.find((goal) => {
     return goal.id == request.params.id;
  });

  let user = users.find((user) => {
    return user.id == request.params.userId;
  });

  if (!user || !goal) {
    response.statusCode = 404;
    return response.end(JSON.stringify({"status": 404, "data": "could not find user or goal"}));
  };

  try {
    user.giftedGoals.push(goal);
    response.statusCode = 500;
    return response.end(JSON.stringify({"status": 500, "data":"success"}));
  } catch (err) {
    response.statusCode = 500;
    return request.end(JSON.stringify({'status': 500, "data": "server error"}));
  }

})



