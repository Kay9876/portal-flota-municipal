import { describe, it, expect } from 'vitest'
import {
  validateCreateUser,
  validateEditUser,
  buildCreateUserPayload,
  buildEditUserPayload,
} from './adminUserValidation'

const validCreateForm = {
  first_name: ' Ana ',
  last_name: ' Pérez ',
  second_last_name: ' López ',
  email: ' ANA.PEREZ@EXAMPLE.COM ',
  password: 'Initial123',
  department_id: '2',
  is_admin: false,
  is_global_viewer: true,
  is_active: true,
  can_view_vehicle: true,
  can_create_vehicle: false,
  can_update_vehicle: true,
}

const validEditForm = {
  ...validCreateForm,
  password: '',
}

describe('Create User validation', () => {
  it('CU-UT-FE-01 accepts valid user information', () => {
    expect(validateCreateUser(validCreateForm)).toEqual({})
  })

  it('CU-UT-FE-02 requires a first name', () => {
    expect(validateCreateUser({ ...validCreateForm, first_name: '  ' }).first_name).toBeDefined()
  })

  it('CU-UT-FE-03 rejects an invalid email', () => {
    expect(validateCreateUser({ ...validCreateForm, email: 'not-an-email' }).email).toBeDefined()
  })

  it('CU-UT-FE-04 requires an initial password with at least 8 characters', () => {
    expect(validateCreateUser({ ...validCreateForm, password: '1234567' }).password).toBeDefined()
  })

  it('CU-UT-FE-05 rejects an invalid department identifier', () => {
    expect(validateCreateUser({ ...validCreateForm, department_id: '-1' }).department_id).toBeDefined()
  })

  it('CU-UT-FE-06 builds a normalized creation payload including the initial password', () => {
    expect(buildCreateUserPayload(validCreateForm)).toEqual({
      first_name: 'Ana',
      last_name: 'Pérez',
      second_last_name: 'López',
      email: 'ana.perez@example.com',
      department_id: '2',
      is_admin: false,
      is_global_viewer: true,
      is_active: true,
      can_view_vehicle: true,
      can_create_vehicle: false,
      can_update_vehicle: true,
      password: 'Initial123',
    })
  })
})

describe('Edit User validation and payload', () => {
  it('EU-UT-FE-01 accepts valid user information without requiring a password', () => {
    expect(validateEditUser(validEditForm)).toEqual({})
  })

  it('EU-UT-FE-02 requires a first name', () => {
    expect(validateEditUser({ ...validEditForm, first_name: '' }).first_name).toBeDefined()
  })

  it('EU-UT-FE-03 rejects an invalid email', () => {
    expect(validateEditUser({ ...validEditForm, email: 'invalid' }).email).toBeDefined()
  })

  it('EU-UT-FE-04 rejects an invalid department identifier', () => {
    expect(validateEditUser({ ...validEditForm, department_id: 'abc' }).department_id).toBeDefined()
  })

  it('EU-UT-FE-05 builds an update payload with the user ID and without a password', () => {
    const payload = buildEditUserPayload('user-123', validEditForm)
    expect(payload).toMatchObject({
      user_id: 'user-123',
      first_name: 'Ana',
      email: 'ana.perez@example.com',
      department_id: '2',
      is_active: true,
    })
    expect(payload).not.toHaveProperty('password')
  })

  it('EU-UT-FE-06 converts an empty department to null', () => {
    expect(buildEditUserPayload('user-123', { ...validEditForm, department_id: '' }).department_id).toBeNull()
  })
})
