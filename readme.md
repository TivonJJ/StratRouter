
ejs ruter auto generator

```javascript
 var r = new StratRouter(app,{ejsPath:"/views/manager",uriPrefix:"/r",controllers:"controllers"});
 r.add('/api',require('../controllers/api'));
 r.add('/article/ueditor',require('../controllers/article/ueditor'),true);
```