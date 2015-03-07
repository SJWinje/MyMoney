AccountList = new Mongo.Collection('accounts');

Router.route('/', function () {
  this.render('Home', {data: {title: 'My Title'}});
});

Router.route('/profile', function () {
  this.render('Profile');
});

Router.route('/accounts', function () {
  this.render('Accounts');
});

Router.route('/accounts/:_id', function () {
  var account = AccountList.findOne({_id: this.params._id});
  this.render('ShowAccount', {data: account});
});

Router.route('/about', function () {
  this.render('About');
});

// Routes to Settings pages
Router.route('/allocations', function () {
  this.render('Allocations');
});

Router.route('/recurring', function () {
  this.render('Recurring');
});

Router.route('/admin', function () {
  this.render('Admin');
});

/*
Router.route('/files/:filename', function () {
  this.response.end('hi from the server\n');
}, {where: 'server'});

Router.route('/restful', {where: 'server'})
  .get(function () {
    this.response.end('get request\n');
  })
  .post(function () {
    this.response.end('post request\n');
  });
*/

if (Meteor.isClient) {
  // counter starts at 0
  Session.setDefault('counter', 0);

  Template.hello.helpers({
    counter: function () {
      return Session.get('counter');
    }
  });

  Template.hello.events({
    'click button': function () {
      // increment the counter when button is clicked
      Session.set('counter', Session.get('counter') + 1);
    }
  });

  Template.addChild.helpers({
    counter: function () {
      return Session.get('counter');
    }
  });

  Template.addChild.events({
    'click button': function () {
      // increment the counter when button is clicked
      Session.set('counter', Session.get('counter') + 1);
    },
    'submit form': function(e) {
      var userName = e.target.userName.value;
      var userPassword = e.target.userPassword.value;
      var userBalance = Number(e.target.userBalance.value);
      console.log("Add child: " + userName + ", " + userPassword + ", " + userBalance );

      e.preventDefault();
      var options = {
        username: userName,
        password: userPassword
      };
      Meteor.call('addUser', options)

      AccountList.insert({
        userName: userName,
        type: "savings",
        balance: userBalance
      });

      e.target.userName.value = null;
      e.target.userPassword.value = null;
      e.target.userBalance.value = null;
    }
  });

  Template.Admin.events({
    'click .remove': function(){
      var selectedUser = this._id;
      console.log("User: " + selectedUser + ", " + AccountList.findOne(selectedUser).userName);
      if (confirm("Are you sure you want to remove player?")) {
        Meteor.call('removeUser', selectedUser);
      }
    }
  });

  Template.Admin.helpers({
    user: function() {
      return AccountList.find();
    }
  });

  Template.showAccounts.helpers({
    user: function() {
      return AccountList.find();
    },
    'selectedUser': function(){
      var userId = this._id;
      var selectedUser = Session.get('selectedUser');
      //console.log("Selected user: " + selectedUser + ", " + AccountList.findOne(selectedUser).userName);
      if (userId == selectedUser) {
        // return this class so CSS can highlight the selected player
        return "selected"
      }
    },
  });

  Template.showAccounts.events({
    'click .user': function(event){
      var userId = this._id;
      Session.set('selectedUser', userId);
    },

  });

  Template.Accounts.helpers({
    'showSelectedUser': function(){
      var userId = this._id;
      var selectedUser = Session.get('selectedUser');
      //console.log("Selected user: " + selectedUser + ", " + AccountList.findOne(selectedUser).userName);
      if (userId == selectedUser) {
      }
      return AccountList.findOne(selectedUser);
    },
  });


  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });

}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });

  Meteor.methods({
    'addUser': function(options){
      Accounts.createUser(options);

    },
    'removeUser': function(user) {
      AccountList.remove(user);
//      Accounts.remove(user);
    }
  });

}
