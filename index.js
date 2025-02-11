require('dotenv').config(); // Load environment variables from .env file
var express = require('express')
var ejs = require('ejs');
var bodyParser = require('body-parser');
var mysql = require('mysql');
var session = require('express-session');

mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})

var app = express();


app.use(express.static('public'));
app.set('view engine', 'ejs');


app.listen(8081);
app.use(bodyParser.urlencoded({extended:true}));
app.use(session({secret:"secret",resave: false,saveUninitialized: false}));

function isProductInCart(cart,id){

    for(let i=0; i<cart.length; i++){
        if(cart[i].id == id){
            return true;
        }

        return false;
    }
}

function calculateTotal(cart,req){

    total = 0;
    for(let i=0; i<cart.length; i++){
        //If we're offering a discounted price
        if(cart[i].sale_price){

            total = total + (cart[i].sale_price*cart[i].quantity);
        }else{
            total = total + (cart[i].price*cart[i].quantity)
        }
    }
    req.session.total = total;
    return total;
}

//localhost: 8081
app.get('/', function(req, res){
    
    var con = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    

    con.query("SELECT * FROM products",(err, result)=>{
        if (err) {
            console.error("Error executing query:", err);
            return;
          }
          console.log("Fetched data: ", result);  // Log the result data here
          res.render('pages/index', { result: result });
    });
});

app.use((req, res, next) => {
    if (!req.session.cart) {
        req.session.cart = []; // Initialize an empty cart if it doesn't exist
    }
    next();
});

app.post('/add_to_cart', function(req,res){
    var id = req.body.id;
    var name = req.body.name;
    var price = req.body.price;
    var sale_price = req.body.sale_price;
    var quantity = req.body.quantity;
    var image = req.body.image;

    var product = {id:id, name:name, price:price, sale_price:sale_price, quantity:quantity, image:image};


    if(req.session.cart){
        var cart = req.session.cart;

        if(!isProductInCart(cart,id)){
            cart.push(product);
        }
    }else{

        req.session.cart = [product];
        var cart = req.session.cart;
    }

    //calculate total
    calculateTotal(cart,req);

    //return to cart page
    res.redirect('/cart');
});

app.get('/cart', function(req,res){

    var cart = req.session.cart;
    var total = req.session.total;
    console.log('Cart:', req.session.cart); // Debug the cart session

    res.render('pages/cart',{cart:cart,total:total});

});

app.post('/remove_product', function(req, res) {
    var id = req.body.id;

    // Check if the cart exists in the session
    if (req.session.cart) {
        var cart = req.session.cart;

        // Filter the cart to remove the product with the matching ID
        req.session.cart = cart.filter(item => item.id != id);

        // Recalculate the total after removing the product
        calculateTotal(req.session.cart, req);
    }

    // Redirect back to the cart page
    res.redirect('/cart');
});


app.post('/edit_product_quantity',function(req,res){
    
    //get values from inputs
    var id = req.body.id;
    var quantity = req.body.quantity;
    var increase_btn = req.body.increase_product_quantity;
    var decrease_btn = req.body.decrease_product_quantity;

    var cart = req.session.cart;

    if(increase_btn){
        for(let i=0; i<cart.length; i++){
            if(cart[i].id==id){
                if(cart[i].quantity>0){
                    cart[i].quantity=parseInt(cart[i].quantity)+1;
             }
          }
       }
    }

    if(decrease_btn){
        for(let i=0; i<cart.length; i++){
            if(cart[i].id==id){
                if(cart[i].quantity>1){
                    cart[i].quantity=parseInt(cart[i].quantity)-1;
              }
           }
        }
     }

    calculateTotal(cart,req);
    res.redirect('/cart');
})

app.get('/checkout', function(req,res){
    var total = req.session.total
    res.render('pages/checkout',{total:total})
})

app.post('/place_order', function(req,res){
    
    // console.log(req.body); // Debugging: Check received data

    var name = req.body.name;
    var email = req.body.email;
    var phone = req.body.phone;
    var city = req.body.city;
    var address = req.body.address;
    var cost = req.session.total;
    var status = "not paid";
    var date = new Date();
    var products_ids="";
    var id = Date.now();
    req.session.order_id = id;
    var mysql = require('mysql');

    var con = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    })

    var cart = req.session.cart;
    for(i=0; i<cart.length; i++){
        products_ids = products_ids + "," + cart[i].id
    }

    con.connect((err)=>{
        if(err){
           console.log(err);
        }else{
           var query = "INSERT INTO orders (id,cost,name,email,status,city,address,phone,date,products_ids) VALUES ?";
           var values = [
              [id,cost,name,email,status,city,address,phone,date,products_ids]
           ];
           
           con.query(query,[values],(err,result)=>{
  
              for(let i=0;i<cart.length;i++){
                 var query = "INSERT INTO order_items (order_id,product_id,product_name,product_price,product_image,product_quantity,order_date) VALUES ?";
                 var values = [
                    [id,cart[i].id,cart[i].name,cart[i].price,cart[i].image,cart[i].quantity,new Date()]
                 ];
                 con.query(query,[values],(err,result)=>{})
              }
  
  
              res.redirect('/payment')
                 
           
            
              
           })
        }
     })
     
      
  })

app.get('/payment',function(req,res){
    var total = req.session.total
    res.render('pages/payment', {total:total})
})


app.get('/verify_payment',function(req,res){
    var transaction_id = req.query.transaction_id;
    // var transaction_id = req.query.transaction_id;
    var order_id = req.session.order_id;
    var mysql = require('mysql');

    var con = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    })

    con.connect((err)=>{
        if(err){
            console.error("Database connection error:", err);
            return res.status(500).send("Database connection failed.");
        }else{
            var query = "INSERT INTO payments (`order_id`,`transaction_id`,`date`) VALUES ?";
            var values = [
                [order_id,transaction_id,new Date()]
               ];
            con.query(query,[values],(err,result)=>{
                con.query("UPDATE orders SET status='paid' WHERE id='"+order_id+"'",(err,result)=>{})
                res.redirect('/thank_you')
               })
            }  
      })   
})

app.get('/thank_you', function(req,res){
    var order_id = req.session.order_id;
    res.render('pages/thank_you',{order_id:order_id})
} )

app.get('/single_product',function(req,res){

    var id = req.query.id;
 
    var con = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    })

    con.query("SELECT * FROM products WHERE id='"+id+"'",(err,result)=>{
       res.render('pages/single_product',{result:result});
    })
 
 });
 
 
 app.get('/products',function(req,res){
 
    var con = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    })
 
    con.query("SELECT * FROM products",(err,result)=>{
       res.render('pages/products',{result:result});
    })
 
   
    
 });
 
 app.get('/about',function(req,res){
    
    res.render('pages/about');
 });
