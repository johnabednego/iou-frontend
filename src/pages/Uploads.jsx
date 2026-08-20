import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Card from '../components/ui/Card';

export default function Uploads() {
  const [uploads, setUploads] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/uploads'); // add endpoint if needed
        setUploads(res.data.data || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  async function download(id) {
    const res = await api.get(`/uploads/${id}/download`);
    window.open(res.data.url);
  }

  async function remove(id) {
    if (!confirm('Delete?')) return;
    try {
      await api.delete(`/uploads/${id}`);
      setUploads(s => s.filter(u => u.id !== id));
    } catch (err) {
      alert('Delete failed');
    }
  }

  return (
    <Card title="Uploads">
      <div className="space-y-2">
        {uploads.length === 0 ? <div>No uploads</div> : uploads.map(u => (
          <div key={u.id} className="flex justify-between">
            <div>{u.file_name}</div>
            <div className="flex gap-2">
              <button className="text-blue-600" onClick={() => download(u.id)}>Download</button>
              <button className="text-red-600" onClick={() => remove(u.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
