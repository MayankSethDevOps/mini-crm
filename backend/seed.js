// seed.js (use node)
const pool = require('./src/db');
(async ()=>{
  for (let i=1;i<=1000;i++){
    const email = `user${i}@example.com`;
    const name = `User ${i}`;
    const spend = Math.floor(Math.random()*20000);
    const visits = Math.floor(Math.random()*12);
    await pool.query('INSERT INTO customers (name,email,total_spend,visits,last_order_at) VALUES (?,?,?,?,?)', [name, email, spend, visits, new Date(Date.now() - Math.floor(Math.random()*200)*24*3600*1000)]);
  }
  console.log('seeded');
  process.exit();
})();
