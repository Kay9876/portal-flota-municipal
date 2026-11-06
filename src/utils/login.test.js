import {describe, it, expect} from 'vitest'
import {friendlyError,validateNewPassword,needsPasswordChange,getAuthScreen,getForceChangeMessage,requestPasswordReset} from "./login";

const sessionWithFlag=(flag)=>({user:{user_metadata:{must_change_password:flag}}})

function fakeSupabase(result){
    const calls=[]
    return {calls, auth:{resetPasswordForEmail: async (email,options)=>{ calls.push({email,options}); return result }}}
}

describe('friendlyError', () => {
    it('LG-UT-FE-01 shows a wrong credentials message', () => {
        expect(friendlyError({message:'Invalid login credentials'})).toBe('Correo electrónico o contraseña incorrecta.')
    })
    it('LG-UT-FE-02 shows a no connection message', () => {
        expect(friendlyError({message:'Failed to fetch'})).toBe('No se pudo conectar con el servidor. Revisa tu conexión a internet.')
    })
})

describe('validateNewPassword', () => {
    it('LG-UT-FE-03 rejects a password with fewer than 8 characters', () => {
        expect(validateNewPassword('abcdefg','abcdefg')).toBe('La contraseña debe tener al menos 8 caracteres.')
    })
    it('LG-UT-FE-04 accepts a password with 8 characters', () => {
        expect(validateNewPassword('abcdefgh','abcdefgh')).toBeUndefined()
    })
    it('LG-UT-FE-05 rejects passwords that do not match', () => {
        expect(validateNewPassword('abcdefgh','abcdefgi')).toBe('Las contraseñas no coinciden.')
    })
})

describe('needsPasswordChange', () => {
    it('LG-UT-FE-06 a new user has to change their password', () => {
        expect(needsPasswordChange(sessionWithFlag(true))).toBe(true)
    })
    it('LG-UT-FE-07 a user who already changed their password does not have to change it', () => {
        expect(needsPasswordChange(sessionWithFlag(false))).toBe(false)
    })
})

describe('getAuthScreen and getForceChangeMessage', () => {
    it('LG-UT-FE-08 a user who is not signed in sees the login page', () => {
        expect(getAuthScreen(null,false)).toBe('login')
    })
    it('LG-UT-FE-09 a new user sees the first-login message', () => {
        expect(getForceChangeMessage(false)).toBe('Esta es tu primera vez entrando al portal. Debes cambiar tu contraseña a una diferente a la que se te ha proveído.')
    })
    it('LG-UT-FE-10 a user with no special case can enter the homepage', () => {
        expect(getAuthScreen(sessionWithFlag(false),false)).toBe('home')
    })
})

describe('forgot password', () => {
    it('LG-UT-FE-11 a user who arrives through a reset link sees the recovery screen', () => {
        expect(getAuthScreen(sessionWithFlag(false),true)).toBe('recovery')
    })
    it('LG-UT-FE-12 a user who arrives through a reset link sees the new password message', () => {
        expect(getForceChangeMessage(true)).toBe('Elige una contraseña nueva para tu cuenta.')
    })
    it('LG-UT-FE-13 the reset email is requested with the trimmed email and the site address', async () => {
        const fake=fakeSupabase({error:null})
        await requestPasswordReset(fake,'  usuario@correo.com  ','https://portal.vegaalta.test')
        expect(fake.calls).toEqual([{email:'usuario@correo.com',options:{redirectTo:'https://portal.vegaalta.test'}}])
    })
    it('LG-UT-FE-14 a successful request shows the confirmation message', async () => {
        const result=await requestPasswordReset(fakeSupabase({error:null}),'usuario@correo.com','https://portal.vegaalta.test')
        expect(result).toEqual({type:'ok',text:'Si el correo está registrado, recibirás un enlace para crear una contraseña nueva.'})
    })
})