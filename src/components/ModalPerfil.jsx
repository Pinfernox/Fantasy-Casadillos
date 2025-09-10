import React, { useState, useEffect, useRef } from 'react'
import './ModalPerfil.css'
import { getAuth, updateProfile, updateEmail, updatePassword } from 'firebase/auth'
import { getFirestore, doc, updateDoc } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import ImagenProfile from '../assets/SinPerfil.jpg'


export default function ModalPerfil({ usuario, openModal, setOpenModal }) {
  const auth = getAuth()
  const db = getFirestore()
  const storage = getStorage()
  const fotoURL = usuario?.fotoPerfil || ImagenProfile
  const [editable, setEditable] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // estados locales
  const [preview, setPreview] = useState(fotoURL)
  const [file, setFile] = useState(null)
  const [nick, setNick] = useState(usuario.nick)
  const [email, setEmail] = useState(usuario.correo)
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [originalNick, setOriginalNick] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');


  // para cerrar al pulsar fuera
  const overlayRef = useRef()

    useEffect(() => {
    if (openModal) {
        setPreview(usuario.fotoPerfil);
        setFile(null);
        setNick(usuario.nick);
        setEmail(usuario.correo);
        setPassword('');

        // guardar originales
        setOriginalNick(usuario.nick);
        setOriginalEmail(usuario.correo);
    }
    }, [openModal, usuario]);


    useEffect(() => {
    const cambios =
        nick !== originalNick ||
        email !== originalEmail ||
        password.length > 0 ||
        file !== null;

    setHasChanges(cambios);
    }, [nick, email, password, file, originalNick, originalEmail]);



  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) {
      setOpenModal(false)
    }
  }

  const handleFileChange = e => {
    const f = e.target.files[0]
    if (!f) return

    setFile(f)
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result)
    reader.readAsDataURL(f)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const user = auth.currentUser

      // 1) sube nueva foto si hay file
      let finalPhotoURL = usuario.fotoPerfil
      if (file) {
        const ext = file.type.split('/')[1]
        const storageRef = ref(storage, `usuarios/${user.uid}/perfil.${ext}`)
        await uploadBytes(storageRef, file)
        finalPhotoURL = await getDownloadURL(storageRef)
        // actualiza perfil Auth
        await updateProfile(user, { photoURL: finalPhotoURL })
      }

      // 2) actualiza nick
      if (nick !== usuario.nick) {
        await updateProfile(user, { displayName: nick })
      }

      // 3) cambia correo
      if (email !== usuario.correo) {
        await updateEmail(user, email)
      }

      // 4) cambia contraseña si se ha escrito
      if (password) {
        await updatePassword(user, password)
      }

      // 5) guarda en Firestore todos los campos
      const userRef = doc(db, 'usuarios', user.uid)
      await updateDoc(userRef, {
        fotoPerfil: finalPhotoURL,
        nick,
        correo: email,
      })

      setOpenModal(false)
    } catch (err) {
      console.error('Error guardando perfil:', err)
      alert('No se pudo guardar los cambios: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!openModal) return null

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <div className="modal-perfil">
        {/* botón cerrar */}
        <button
          className="modal-close-btn"
          onClick={() => setOpenModal(false)}
        >
          ×
        </button>

        <div className="modal-header">
          <label className="modal-avatar">
            <img src={preview} alt="Avatar" />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </label>
          <div className="modal-userinfo">
            <h2>{usuario.nick}</h2>
            <small>{usuario.correo}</small>
          </div>
        </div>
        <hr/>
        <div className="modal-body">
          <div className="field-group">
            <label>Nick</label>
            <div className="field-with-icon">
              <input
                type="text"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                disabled={!editable} // solo editable si el estado es true}
              />
            <button
                    className="icon-pencil"
                    onClick={() => setEditable(!editable)}
                    title="Editar nick"
                >
            ✎
            </button>
            </div>
          </div>

          <div className="field-group">
            <label>Correo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={true}
            />
          </div>

          <div className="field-group">
            <label>Nueva contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          {hasChanges && <button
            className="modal-save-btn"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Guardando…' : 'Guardar cambios'}
          </button>}
        </div>
      </div>
    </div>
  )
}
