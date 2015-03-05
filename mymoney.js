AccountsList = new Mongo.Collection('accounts');

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
  var account = Accounts.findOne({_id: this.params._id});
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
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
