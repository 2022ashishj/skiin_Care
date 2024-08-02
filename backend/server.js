const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET_KEY = 'your-secret-key';

server.use(middlewares);
server.use(jsonServer.bodyParser);

// Authentication middleware
server.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/users') {
    return next();
  }

  if (req.path === '/login') {
    return next();
  }

  if (req.path.startsWith('/products')) {
    return next();
  }

  if (req.headers.authorization) {
    const token = req.headers.authorization.split(' ')[1];
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
});

// User signup
server.post('/users', (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    const hashedPassword = bcrypt.hashSync(password, 8);
    const db = router.db;
    const user = { email, password: hashedPassword };
    const newUser = db.get('users').push(user).write();
    
    // Create an empty cart for the new user
    db.get('carts').push({ userId: newUser.id, items: [] }).write();
    
    res.status(201).json({ message: 'User created successfully' });
  } else {
    res.status(400).json({ error: 'Email and password are required' });
  }
});

// User login
server.post('/login', (req, res) => {
  const { email, password } = req.body;
  const db = router.db;
  const user = db.get('users').find({ email }).value();

  if (user && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(400).json({ error: 'Invalid email or password' });
  }
});

// Fetch products
server.get('/products/:category', (req, res) => {
  const category = req.params.category;
  const db = router.db;
  const products = db.get(category).value();
  res.json(products);
});

// Get user's cart
server.get('/cart', (req, res) => {
  const db = router.db;
  const cart = db.get('carts').find({ userId: req.user.id }).value();
  res.json(cart);
});

// Add item to cart
server.post('/cart', (req, res) => {
  const { productId, quantity } = req.body;
  const db = router.db;
  const cart = db.get('carts').find({ userId: req.user.id });
  
  const existingItem = cart.get('items').find({ productId }).value();
  if (existingItem) {
    cart.get('items').find({ productId }).assign({ quantity: existingItem.quantity + quantity }).write();
  } else {
    cart.get('items').push({ productId, quantity }).write();
  }
  
  res.json(cart.value());
});

// Remove item from cart
server.delete('/cart/:productId', (req, res) => {
  const productId = req.params.productId;
  const db = router.db;
  const cart = db.get('carts').find({ userId: req.user.id });
  
  cart.get('items').remove({ productId }).write();
  
  res.json(cart.value());
});

server.use(router);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`JSON Server is running on port ${PORT}`);
});