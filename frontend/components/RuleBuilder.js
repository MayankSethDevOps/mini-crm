import { useState } from 'react';
import axios from 'axios';

export default function RuleBuilder({ onSave }) {
  const [conds, setConds] = useState([{ field:'total_spend', comparator:'>', value:10000 }]);
  const [op, setOp] = useState('AND');

  const addCond = () => setConds([...conds, { field:'visits', comparator:'<', value:3 }]);
  const update = (i, key, value) => {
    const copy = [...conds]; copy[i][key]=value; setConds(copy);
  };
  const preview = async () => {
    const rule = { op, conditions: conds };
    const resp = await axios.post('/api/segments/preview', { rule }, { withCredentials: true });
    alert(`Audience size: ${resp.data.audience}`);
  };
  return (
    <div>
      <div>
        <label>Operator:</label>
        <select value={op} onChange={e=>setOp(e.target.value)}><option>AND</option><option>OR</option></select>
      </div>
      {conds.map((c,i)=>(
        <div key={i}>
          <select value={c.field} onChange={e=>update(i,'field',e.target.value)}>
            <option value="total_spend">total_spend</option>
            <option value="visits">visits</option>
            <option value="INACTIVE_DAYS_GT">inactive_days</option>
          </select>
          <select value={c.comparator} onChange={e=>update(i,'comparator',e.target.value)}>
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value="=">=</option>
          </select>
          <input value={c.value} onChange={e=>update(i,'value',e.target.value)} />
        </div>
      ))}
      <button onClick={addCond}>Add</button>
      <button onClick={preview}>Preview Audience</button>
      <button onClick={()=>onSave({ op, conditions: conds })}>Save segment</button>
    </div>
  )
}
