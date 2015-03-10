AccountList = new Mongo.Collection('accounts');
TransactionList = new Mongo.Collection('transactions');

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup

    // Insert dummy test data
    if (AccountList.find().count() == 0) {
      console.log("Add initial test data to db");
      var gId = Meteor.call('addUser', {username :"Gracelyn", password:"123456"}, "Savings");
      Meteor.call('creditOrDebitAccount', gId, 1000, "Initial Balance", "02/01/2015");
      Meteor.call('creditOrDebitAccount', gId, -30, "Cell Phone", "03/01/2015");
      Meteor.call('creditOrDebitAccount', gId, 60, "Grades", "03/09/2015");
      Meteor.call('creditOrDebitAccount', gId, 204, "Babysitting", "03/03/2015");
      var cId = Meteor.call('addUser', {username :"Christian", password:"123456"}, "Savings");
      Meteor.call('creditOrDebitAccount', cId, 627, "Initial Balance", "02/01/2015");
      Meteor.call('creditOrDebitAccount', cId, -30, "Cell Phone", "02/01/2015");
      var transactionIdToVoid = Meteor.call('creditOrDebitAccount', cId, -25, "PC Game", "02/15/2015");
      Meteor.call('creditOrDebitAccount', cId, -30, "Cell Phone", "03/01/2015");
      Meteor.call('voidTransaction', cId, 25, transactionIdToVoid);
      var vId = Meteor.call('addUser', {username :"Victoria", password:"123456"}, "Savings");
    }
  });

  Meteor.methods({
    'users': function(){
      return AccountList.find().fetch();
    },
    'getUser': function(userId){
      return AccountList.findOne(userId);
    },
    'addUser': function(options, type){
      Accounts.createUser(options);
      var userId = AccountList.insert({
        userName: options.username,
        type: type
      });
      return userId;
    },
    'removeUser': function(user) {
      var userName = AccountList.findOne(user).userName;
      AccountList.remove(user);
      TransactionList.find({user: user}).forEach (
        function(transactionId) {
          var amount = TransactionList.findOne(transactionId).amount;
          //console.log("Remove trans id: " + transactionId + " for: " + userName + " by " + amount );
          TransactionList.remove(transactionId);
        }
      );
      var u = Meteor.users.findOne({username:userName});
      Meteor.users.remove({_id:u._id});
    },
//    'getTransaction': function(transactionId){
//      return TransactionList.findOne(transactionId);
//    },
    'creditOrDebitAccount': function(selectedUser, amount, descr, date) {
      AccountList.update(selectedUser, {$inc: {balance: amount} });
      var transactionId = TransactionList.insert(
        {
          date: date,
          amount: amount,
          subAccount: "Savings",
          description: descr,
          user: selectedUser
        }
      );
      return transactionId;
    },
    // Only called when voiding a transaction
    'voidTransaction': function(selectedUser, amount, transactionId) {
      // Update balance by the voided amount
      AccountList.update(selectedUser, {$inc: {balance: amount} });

      // Get today's date
      var d = new Date();
      var dd = d.getDate();
      var mm = d.getMonth()+1; // add one since index starts at 0 for January
      var yyyy = d.getFullYear();
      var today = mm + "/" + dd + "/" + yyyy;

      // Get the description and date of the transaction being voided
      var vDescr = TransactionList.findOne(transactionId).description;
      var vDate = TransactionList.findOne(transactionId).date;

      // Add the void as a transaction
      var voidId = TransactionList.insert(
        {
          date: today,
          amount: amount,
          subAccount: "Savings",
          user: selectedUser,
          void: true
        }
      );
      // Update the void to include the id to tie it to the voided transaction
      TransactionList.update(
        voidId,
        {$set:
          {
            description: "Voided \"" + vDate + " $" + (-amount) + " " + vDescr + "\" transaction (Void id: " + voidId + ")"
          }
        }
      );
      // Update the description of the voided transaction
      TransactionList.update(
        transactionId,
        {$set:
          {
            description: vDescr + " (Voided by " + voidId + ")",
            void: true
          }
        }
      );
    },
    'removeTransaction': function(transactionId) {
      TransactionList.remove(transactionId);
//      Accounts.remove(user);
    },
  });
}

if (Meteor.isClient) {
  // counter starts at 0
  Session.setDefault('counter', 0);
  Session.set('onAdminPage', false);
  Session.set('enableVoid', false);
  Session.set('showVoided', false);

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

  //
  // addChild Template helpers and events
  //
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
      //console.log("Add child: " + userName + ", " + userPassword); // + ", " + userBalance );

      e.preventDefault();
      var options = {
        username: userName,
        password: userPassword
      };
      var type = "savings";
      Meteor.call('addUser', options, type);

      e.target.userName.value = null;
      e.target.userPassword.value = null;
    }
  });

  //
  // creditDebit Template helpers and events
  //
  Template.creditDebit.events({
    'submit form': function(e) {
      var selectedUser = Session.get('selectedUser');
      var descr = e.target.descr.value;
      var date = e.target.datepicker.value;
      var amount = Number(e.target.amount.value);
      var creditOrDebit = (amount<0) ? "Debit " : "Credit ";
      //console.log(creditOrDebit + AccountList.findOne(selectedUser).userName + "'s account by " + amount + ", " + descr + " on " + date );

      Meteor.call('creditOrDebitAccount', selectedUser, amount, descr, date);
      e.target.amount.value = null;
      e.target.descr.value = null;
    },
    'focus #datepicker': function () {
      // show datepicker
      $('#datepicker').datepicker('show');
    }
  });

  Template.creditDebit.rendered = function() {
    // initialize datepicker
    $('#datepicker').datepicker({
      format: 'm, dd, yyyy'
    });
  };

  //
  // Admin Template helpers and events
  //
  Template.Admin.events({
    'click .remove': function(){
      var selectedUser = this._id;
      //console.log("User: " + selectedUser + ", " + AccountList.findOne(selectedUser).userName);
      if (confirm("Are you sure you want to remove user?")) {
        Meteor.call('removeUser', selectedUser);
      }
    }
  });

  Template.Admin.helpers({
    user: function() {
      return AccountList.find();
      //return Meteor.call('users');
    }
  });

  //
  // showAccounts Template helpers and events
  //
  Template.showAccounts.helpers({
    user: function() {
      return AccountList.find();
      //return Meteor.call('users');
    },
    userBalance: function() {
      var userId = this._id;
      var balance = AccountList.findOne(userId).balance;
      //var user = Meteor.call('getUser', userId);
      //var balance = user.balance;
      if (balance == null) {
        return 0;
      }
      else {
        return balance;
      }

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
    'onAdminPage': function(){
      var onAdminPage = Session.get('onAdminPage');
      return onAdminPage;
    }
  });

  Template.showAccounts.events({
    'click .user': function(event){
      var userId = this._id;
      Session.set('selectedUser', userId);
    },
    'mousedown .user': function(event){
      var userId = this._id;
      Session.set('selectedUser', userId);
    },
    'touchstart .user': function(event){
      var userId = this._id;
      Session.set('selectedUser', userId);
    },

  });

  //
  // Accounts Template helpers and events
  //
  Template.Accounts.helpers({
    'showSelectedUser': function(){
      var userId = this._id;
      var selectedUser = Session.get('selectedUser');
      //console.log("Selected user: " + selectedUser + ", " + AccountList.findOne(selectedUser).userName);
      if (userId == selectedUser) {
      }
      //return Meteor.call('getUser', selectedUser);
      return AccountList.findOne(selectedUser);
    },
  });

  Template.Accounts.events({
  });

  //
  // transactions Template helpers and events
  //
  Template.transactions.events({
    'click .void': function(){
      var transactionId = this._id;

      var selectedUser = Session.get('selectedUser');
//      var amount = -Meteor.call('getTransaction', transactionId).amount;
      var amount = -(TransactionList.findOne(transactionId).amount);
      var creditOrDebit = (amount<0) ? "Debit " : "Credit ";
      //console.log("id: " + selectedUser + " " + creditOrDebit + AccountList.findOne(selectedUser).userName + "'s account by " + amount );

      if (confirm("Are you sure you want to void this transaction?")) {
        Meteor.call('voidTransaction', selectedUser, amount, transactionId);
        //Meteor.call('removeTransaction', transactionId);
      }
      Session.set('showVoided', true); // so user can confirm voided transaction
    },
    'click .toggleEnableVoid': function(){
      Session.set('enableVoid', !Session.get('enableVoid'));
    },
    'click .toggleShowVoided': function(){
      Session.set('showVoided', !Session.get('showVoided'));
    },
  });

  Template.transactions.helpers({
    transaction: function() {
      var selectedUser = Session.get('selectedUser');
      if (Session.get('showVoided')) {
        return TransactionList.find({user: selectedUser}, {sort: {date: 1}});
      }
      else {
        return TransactionList.find({user: selectedUser, void: {$ne: true}}, {sort: {date: 1}});
      }
    },
    enableVoid: function() {
      return Session.get('enableVoid');
    },
    showVoided: function() {
      return Session.get('showVoided');
    }
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });

}

Router.route('/', function () {
  this.render('Home', {data: {title: 'My Title'}});
});

Router.route('/profile', function () {
  this.render('Profile');
});

Router.route('/accounts', function () {
  Session.set('onAdminPage', false);
  this.render('Accounts');
});

Router.route('/accounts/:_id', function () {
  Session.set('onAdminPage', false);
  this.render('Accounts');
//  var account = AccountList.findOne({_id: this.params._id});
//  this.render('ShowAccount', {data: account});
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
  Session.set('onAdminPage', true);
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
