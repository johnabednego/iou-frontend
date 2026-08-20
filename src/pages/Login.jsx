import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../components/ui/Input';
import { AuthContext } from '../contexts/AuthContext';
import mpsLogo from '../assets/mps.svg';
import { toast } from 'react-toastify';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handle(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Logged in successfully!');
      nav('/');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 flex items-center justify-center bg-slate-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-br from-indigo-900 to-[#1F88E5] skew-y-6 -translate-y-32 z-0" />

      <div className="max-w-md w-full relative z-10 flex flex-col items-center p-8 sm:p-10 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white">

        <img src={mpsLogo} alt="mps logo" />
        <div className='max-w-md w-full mt-10'>
          <div className='mb-4'>
            <h2 className="text-2xl font-bold">MPS IOU</h2>
            <p className='text-[14px] text-[#707070]'>Sign in with your windows account</p>
          </div>
          <form onSubmit={handle} className="flex flex-col gap-4">
            <Input label="Username" required value={username} onChange={(e) => setUsername(e.target.value)} />
            <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="flex justify-center mt-4">
              <button disabled={loading ? true : false} className={` ${loading ? " cursor-not-allowed opacity-70" : ""} w-full h-[40px] rounded-[30px] font-semibold text-[16px] bg-[#1F88E5] text-white hover:opacity-70 transform transition-all ease-in-out`} type="submit">{loading ? 'Signing in...' : 'Sign in'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
