BankList        = new Mongo.Collection('banks');
AccountList     = new Mongo.Collection('accounts');
TransactionList = new Mongo.Collection('transactions');

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup

    // Insert dummy test data
    if (AccountList.find().count() == 0) {
      console.log("Add initial test data to db");
      var ids;
      var accountId;

      ids = Meteor.call('addUser', {username :"Gracelyn", password:"123456"}, "Savings");
//      accountId = Meteor.call('addAccount', userId, "Savings");
      Meteor.call('creditOrDebitAccount', ids.accountId, 1000, "Initial Balance", "02/01/2015");
      Meteor.call('creditOrDebitAccount', ids.accountId, -30, "Cell Phone", "03/01/2015");
      Meteor.call('creditOrDebitAccount', ids.accountId, 60, "Grades", "03/09/2015");
      Meteor.call('creditOrDebitAccount', ids.accountId, 204, "Babysitting", "03/03/2015");

      ids = Meteor.call('addUser', {username :"Christian", password:"123456"}, "Savings");
//      accountId = Meteor.call('addAccount', userId, "Savings");
      Meteor.call('creditOrDebitAccount', ids.accountId, 627, "Initial Balance", "02/01/2015");
      Meteor.call('creditOrDebitAccount', ids.accountId, -30, "Cell Phone", "02/01/2015");
      var transactionIdToVoid = Meteor.call('creditOrDebitAccount', ids.accountId, -25, "PC Game", "02/15/2015");
      Meteor.call('creditOrDebitAccount', ids.accountId, -30, "Cell Phone", "03/01/2015");
      Meteor.call('voidTransaction', ids.accountId, 25, transactionIdToVoid);

      ids = Meteor.call('addUser', {username :"Victoria", password:"123456"}, "Savings");
//      accountId = Meteor.call('addAccount', userId, "Savings");
    }
  });

  Meteor.methods({
    'users': function(){
      return AccountList.find().fetch();
    },

    'getUser': function(userId){
      return AccountList.findOne(userId);
    },

    'addBank': function(bank, adminIds, childIds) {
      BankList.insert(
        {
          name: bank,
          admins: adminIds,
          users: childIds
        }
      );
    },
    'addUser': function(options, type){
      var user_id = Accounts.createUser(options);
      console.log("Meteor.addUser user_id: " + user_id);
      var accountId = AccountList.insert({
        user_id: user_id,
        type: type
      });
      console.log("Meteor.addUser accountId: " + accountId);
      return {
        userId: user_id,
        accountId: accountId
      };
    },
    'addAccount': function(userId, type){
      console.log("Meteor.addAccount userId: " + userId);
      var accountId = AccountList.insert({
        user_id: userId,
        type: type
      });
      return accountId;
    },
    'removeUser': function(account) {
      console.log("Remove account: " + account);
      var user_id = AccountList.findOne(account).user_id;
      AccountList.remove(account);
      TransactionList.find({account_id: account}).forEach (
        function(transactionId) {
          console.log("Remove trans id: " + transactionId._id);
          TransactionList.remove(transactionId);
        }
      );
      console.log("Remove user: " + user_id);
      Meteor.users.remove({_id: user_id});
    },
    'quickSetup': function(bank, admin, adminPassword, child, defaultPassword) {
      var type = "Savings";
      var adminIds = [];
      var childIds = [];

      admin.forEach(function(a) {
        a = a.trim();
        var options = {
          username: a,
          password: adminPassword,
          profile: {admin: true}
        };
        var ids = Meteor.call('addUser', options, "None");
        // Admin users do not need accounts
        //accountId = Meteor.call('addAccount', userId, "Savings");
        adminIds.push(ids.userId);
      });

      child.forEach(function(c) {
        c = c.trim();
        var options = {
          username: c,
          password: defaultPassword
        };
        // TODO: figure out why this is not being called and returing a user_id
        var ids = Meteor.call('addUser', options, "Savings");
        console.log("quick addAccount for: " + c + " (" + ids.userId + ")");
        //          accountId = Meteor.call('addAccount', userId, "Savings");
        childIds.push(ids.userId);
      });

      Meteor.call('addBank', bank, adminIds, childIds);
    },

//    'getTransaction': function(transactionId){
//      return TransactionList.findOne(transactionId);
//    },
    'creditOrDebitAccount': function(selectedAccount, amount, descr, date) {
      AccountList.update(selectedAccount, {$inc: {balance: amount} });
      var transactionId = TransactionList.insert(
        {
          date: date,
          amount: amount,
          subAccount: "Savings",
          description: descr,
          account_id: selectedAccount
        }
      );
      return transactionId;
    },
    // Only called when voiding a transaction
    'voidTransaction': function(selectedAccount, amount, transactionId) {
      // Update balance by the voided amount
      AccountList.update(selectedAccount, {$inc: {balance: amount} });

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
          account_id: selectedAccount,
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

  //
  // QuickSetup Template helpers and events
  //
  Template.QuickSetup.events({
    'submit form': function(e) {
      var bank = e.target.bank.value;
      var admins = e.target.admins.value;
      var admin = admins.split(",");
      var adminPassword = e.target.adminPassword.value;
      var children = e.target.children.value;
      var child = children.split(",");
      var defaultPassword = e.target.defaultPassword.value;
      var inputsOkay = true;

      e.preventDefault();

      if (bank == "") {
        alert("Name of Bank required");
        inputsOkay = false;
      }
      else if (admins == "") {
        alert("Name(s) of Administrator(s) required");
        inputsOkay = false;
      }
      else if ((adminPassword == "") || (adminPassword.length <6)) {
        alert("Administrator Password is required and must be at least 6 characters");
        inputsOkay = false;
      }
      else if (children == "") {
        alert("Names of Children are required");
        inputsOkay = false;
      }
      else if ((defaultPassword == "") || (defaultPassword.length <6)) {
        alert("Default Password is required and must be at least 6 characters");
        inputsOkay = false;
      }
      else {
        console.log("Bank: " + bank);

        admin.forEach(function(a) {
          a = a.trim();
          if (a.length < 3) {
            alert("Administrator's names: \"" + a + "\" must be 3 or more characters");
            inputsOkay = false;
          }
          else {
            console.log("Admin: " + a + " Password:" + adminPassword);
          }
        });

        child.forEach(function(c) {
          c = c.trim();
          if (c.length < 3) {
            alert("Children's names: \"" + c + "\" must be 3 or more characters");
            inputsOkay = false;
          }
          else {
            console.log("Child: " + c + " Password:" + defaultPassword);
          }
        });
      }

      if (inputsOkay) {
        console.log("All inputs okay");

        Meteor.call('quickSetup', bank, admin, adminPassword, child, defaultPassword);
        /*
        var type = "Savings";
        var adminIds = [];
        var childIds = [];

        admin.forEach(function(a) {
          a = a.trim();
          var options = {
            username: a,
            password: adminPassword,
            profile: {admin: true}
          };
          var ids = Meteor.call('addUser', options, "None");
          // Admin users do not need accounts
          //accountId = Meteor.call('addAccount', userId, "Savings");
          adminIds.push(ids.userId);
        });

        child.forEach(function(c) {
          c = c.trim();
          var options = {
            username: c,
            password: defaultPassword
          };
          // TODO: figure out why this is not being called and returing a user_id
          var ids = Meteor.call('addUser', options, "Savings");
          console.log("quick addAccount for: " + c + " (" + ids.userId + ")");
//          accountId = Meteor.call('addAccount', userId, "Savings");
          childIds.push(ids.userId);
        });

        Meteor.call('addBank', bank, adminIds, childIds);
        */
        /*
        e.target.bank.value = null;
        e.target.admins.value = null;
        e.target.adminPassword.value = null;
        e.target.children.value = null;
        e.target.defaultPassword.value = null;
        */
      }
    }
  });

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
      var type = "Savings";
      console.log("addChild: " + userName);
      var ids = Meteor.call('addUser', options, type); /*, function(err, res) {
        if (err) { console.log("Error");}
        else {console.log("Result: " + res);}
      });*/
      // ids.userId and ids.accountId come back as undefined
      //console.log("addChild returned userId: " + ids.userId);
      //console.log("addChild returned accountId: " + ids.accountId);
//      Meteor.call('addAccount', userId, type);

      e.target.userName.value = null;
      e.target.userPassword.value = null;
    }
  });

  //
  // creditDebit Template helpers and events
  //
  Template.creditDebit.events({
    'submit form': function(e) {
      var selectedAccount = Session.get('selectedAccount');
      var descr = e.target.descr.value;
      var date = e.target.datepicker.value;
      var amount = Number(e.target.amount.value);
      var creditOrDebit = (amount<0) ? "Debit " : "Credit ";
      //console.log(creditOrDebit + AccountList.findOne(selectedUser).userName + "'s account by " + amount + ", " + descr + " on " + date );

      Meteor.call('creditOrDebitAccount', selectedAccount, amount, descr, date);
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
      // TODO: fix this
      var selectedAccount = this._id;
      //console.log("account_id: " + selectedUser + ", " + AccountList.findOne(selectedUser).userName);
      if (confirm("Are you sure you want to remove account " + selectedAccount + "?")) {
        Meteor.call('removeUser', selectedAccount);
      }
    }
  });

  Template.Admin.helpers({
    account: function() {
      return AccountList.find();
      //return Meteor.call('users');
    }
  });

  //
  // showAccounts Template helpers and events
  //
  Template.showAccounts.helpers({
    user: function() {
      return Meteor.users.find();
      //return Meteor.call('users');
    },
    account: function() {
      return AccountList.find();
      //return Meteor.call('users');
    },
    /*
    userName: function() {
      var user = Meteor.users.findOne({_id: this.user_id});
      //console.log("showAccounts userName: " + user.username);
      return user.username;
    },
    */
    'userName': function() {
      var selectedAccount = this._id;
      var user_id = AccountList.findOne(selectedAccount).user_id;
      var user = Meteor.users.findOne({_id: user_id});
//      console.log("1.showAccounts userName selectedAccount: " + selectedAccount);
//      console.log("2.showAccounts userName user_id: " + user_id);
      if (user) {
//        console.log("3.showAccounts userName: " + user.username);
        return user.username;
      }
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
    'selectedAccount': function(){
      var userId = this._id;
      var selectedAccount = Session.get('selectedAccount');
      //console.log("ShowAccounts accountId: " + selectedAccount);
      if (userId == selectedAccount) {
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
    'click .account': function(event){
      var accountId = this._id;
      Session.set('selectedAccount', accountId);
    },
    'mousedown .account': function(event){
      var accountId = this._id;
      Session.set('selectedAccount', accountId);
    },
    'touchstart .account': function(event){
      var accountId = this._id;
      Session.set('selectedAccount', accountId);
    },

  });

  //
  // Accounts Template helpers and events
  //
  Template.Accounts.helpers({
    'showSelectedUser': function(){
      var selectedAccount = Session.get('selectedAccount');
      return AccountList.findOne(selectedAccount);
    },
    'userName': function() {
      var selectedAccount = Session.get('selectedAccount');
      var user_id = AccountList.findOne(selectedAccount).user_id;
      var user = Meteor.users.findOne({_id: user_id});
      console.log("1.Accounts userName selectedAccount: " + selectedAccount);
      console.log("2.Accounts userName user_id: " + user_id);
      console.log("3.Accounts userName: " + user.username);
      return user.username;
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

      var selectedAccount = Session.get('selectedAccount');
//      var amount = -Meteor.call('getTransaction', transactionId).amount;
      var amount = -(TransactionList.findOne(transactionId).amount);
      var creditOrDebit = (amount<0) ? "Debit " : "Credit ";
      console.log("trans id: " + transactionId + " id: " + selectedAccount + " " + creditOrDebit + Meteor.users.findOne(AccountList.findOne(selectedAccount).user_id).username + "'s account by " + amount );

      if (confirm("Are you sure you want to void this transaction?")) {
        Meteor.call('voidTransaction', selectedAccount, amount, transactionId);
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
    'click .reactive-table tr': function(event) {
      var transaction = this;
      event.preventDefault();
      console.log("Selected row: " + transaction._id);
    },
  });

  Template.transactions.helpers({
    transactions: function() {
      var selectedAccount = Session.get('selectedAccount');
      //console.log("transactions accountId: " + selectedAccount);
      if (Session.get('showVoided')) {
        return TransactionList.find({account_id: selectedAccount}, {sort: {date: 1}});
      }
      else {
        return TransactionList.find({account_id: selectedAccount, void: {$ne: true}}, {sort: {date: 1}});
      }
    },
    enableVoid: function() {
      return Session.get('enableVoid');
    },
    showVoided: function() {
      return Session.get('showVoided');
    },
    tableSettings : function () {
      if (Session.get('enableVoid')) {
        return {
            fields: [
              { key: 'date', label: 'Date', cellClass: 'col-md-1' },
              { key: 'amount', label: 'Amount', cellClass: 'col-md-1' },
              { key: 'description', label: 'Description', cellClass: 'col-md-9' },
              { key: '_id', label: 'Void', fn: function(value) {
                  return new Spacebars.SafeString('<button class="void btn btn-warning">Void ' + value + '</button>');
                }, cellClass: 'col-md-1'
              }
            ]
        };
      }
      else {
        return {
            fields: [
              { key: 'date', label: 'Date', cellClass: 'col-md-1' },
              { key: 'amount', label: 'Amount', cellClass: 'col-md-1' },
              { key: 'description', label: 'Description', cellClass: 'col-md-10' }
            ]
        };
      }
    },
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
// http://meteortips.com/tutorial/iron-router-part-2/
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

Router.route('/quicksetup', function () {
  this.render('QuickSetup');
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
