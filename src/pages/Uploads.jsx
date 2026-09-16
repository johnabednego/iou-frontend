import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Card from '../components/ui/Card';
import ConfirmModal from '../components/ui/ConfirmModal';

export default function Uploads() {
  const [uploads, setUploads] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: '' });
  const [errorModal, setErrorModal] = useState({ open: false, message: '' });

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

  function remove(id) {
    const upload = uploads.find(u => u.id === id);
    setDeleteModal({ open: true, id, name: upload?.file_name || 'this file' });
  }

  async function confirmDelete() {
    const { id } = deleteModal;
    setDeleteModal({ open: false, id: null, name: '' });
    if (!id) return;
    try {
      await api.delete(`/uploads/${id}`);
      setUploads(s => s.filter(u => u.id !== id));
    } catch (err) {
      setErrorModal({ open: true, message: 'Failed to delete the file. Please try again.' });
    }
  }

  return (
    <>
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null, name: '' })}
        onConfirm={confirmDelete}
        title="Delete File"
        message={<>Are you sure you want to delete <strong>{deleteModal.name}</strong>? This action cannot be undone.</>}
        confirmText="Delete"
        variant="danger"
      />

      {/* Error Alert Modal */}
      <ConfirmModal
        open={errorModal.open}
        onClose={() => setErrorModal({ open: false, message: '' })}
        title="Error"
        message={errorModal.message}
        mode="alert"
        variant="danger"
      />
    </>
  );
}
