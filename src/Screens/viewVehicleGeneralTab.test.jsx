
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import VehicleGeneralTab from './viewVehicleGeneralTab'
import { supabase } from '../supabaseClient'
import React from 'react'


afterEach(() => {
  cleanup()
})

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn()
  }
}))

const mockVehicle = {
  id: 1,
  license_plate: 'ABC123',
  manufacturer: 'Toyota',
  model: 'Corolla',
  year: 2020,
  department_id: 1,
  is_active: true,
  vin: '1HGCM82633A004352',
  total_mileage: 25000
}

let updateMock
let onVehicleUpdated
let permissionAllowed = true
let permissionQueryMock
let isAdmin = false

beforeEach(() => {
    vi.clearAllMocks()
    permissionAllowed = true
    isAdmin = false

    supabase.auth.getUser.mockResolvedValue({
        data: {
        user: { id: 'test-user-1' }
        },
        error: null
    })

    onVehicleUpdated = vi.fn()
    updateMock = vi.fn()

    permissionQueryMock = vi.fn().mockImplementation(async () => ({
        data: permissionAllowed ? [{ id: 1 }] : [],
        error: null
    }))

  supabase.from.mockImplementation((table) => {

    if (table === 'profiles') {
    return {
        select: () => ({
        eq: () => ({
            maybeSingle: async () => ({
            data: {
                is_active: true,
                is_admin: isAdmin
            },
            error: null
            })
        })
        })
    }
    }

    if (table === 'user_permissions') {
    return {
        select: () => ({
            eq: () => ({
            eq: () => ({
            eq: () => ({
                limit: permissionQueryMock
            })
            })
        })
        })
    }
    }
    if (table === 'departments') {
      return {
        select: () => ({
          order: async () => ({
            data: [{ id: 1, name: 'Obras Públicas' }],
            error: null
          })
        })
      }
    }

    if (table === 'vehicles') {
      return {
        update: updateMock
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })
})

function renderVehicle() {
  return render(
    <VehicleGeneralTab
      vehicle={mockVehicle}
      statusLabel="Activo"
      onVehicleUpdated={onVehicleUpdated}
    />
  )
}

describe('Vehicle Information - Component Tests', () => {
  it('VI-UT-FE-07 displays vehicle information', async () => {
    renderVehicle()

    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText('Toyota')).toBeInTheDocument()
    expect(screen.getByText('Corolla')).toBeInTheDocument()
    expect(screen.getByText('1HGCM82633A004352')).toBeInTheDocument()
    expect(await screen.findByText('Obras Públicas')).toBeInTheDocument()
  })

  it('VI-UT-FE-08 opens the edit form', async () => {
    renderVehicle()

    fireEvent.click(
    await screen.findByRole('button', { name: 'Editar' })
    )

    expect(
      screen.getByText('Editar información del vehículo')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Guardar cambios' })
    ).toBeInTheDocument()
  })

  it('VI-UT-FE-09 cancels without saving changes', async () => {
    renderVehicle()

    fireEvent.click(
        await screen.findByRole('button', { name: 'Editar' })
    )
    fireEvent.change(screen.getByLabelText('Marca'), {
      target: { value: 'Honda' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(
      screen.queryByText('Editar información del vehículo')
    ).not.toBeInTheDocument()

    expect(updateMock).not.toHaveBeenCalled()
    expect(onVehicleUpdated).not.toHaveBeenCalled()
    expect(screen.getByText('Toyota')).toBeInTheDocument()
  })

  it('VI-UT-FE-10 rejects invalid VINs without updating', async () => {
    renderVehicle()

    fireEvent.click(
        await screen.findByRole('button', { name: 'Editar' })
    )

    fireEvent.change(screen.getByLabelText('VIN'), {
      target: { value: '12345' }
    })
    fireEvent.submit(
        screen.getByRole('button', { name: 'Guardar cambios' }).closest('form')
    )

    expect(
      await screen.findByText('El VIN debe contener 17 caracteres válidos.')
    ).toBeInTheDocument()

    expect(updateMock).not.toHaveBeenCalled()
  })

  
    it('VI-UT-FE-11 saves valid vehicle changes', async () => {
        const updatedVehicle = {
            ...mockVehicle,
            manufacturer: 'Honda',
            total_mileage: 30000
        }

        const singleMock = vi.fn().mockResolvedValue({
            data: updatedVehicle,
            error: null
        })
        const selectMock = vi.fn(() => ({ single: singleMock }))
        const eqMock = vi.fn(() => ({ select: selectMock }))

        updateMock.mockReturnValue({ eq: eqMock })

        renderVehicle()

        fireEvent.click(
            await screen.findByRole('button', { name: 'Editar' })
        )
        await screen.findByRole('option', { name: 'Obras Públicas' })

        fireEvent.change(screen.getByLabelText('Marca'), {
            target: { value: 'Honda' }
        })

        fireEvent.change(screen.getByLabelText('Millaje total'), {
            target: { value: '30000' }
        })

        fireEvent.change(screen.getByLabelText('Departamento'), {
            target: { value: '1' }
        })

        fireEvent.change(screen.getByLabelText('Estado'), {
            target: { value: 'true' }
        })

        fireEvent.submit(
            screen.getByRole('button', { name: 'Guardar cambios' }).closest('form')
        )

        await waitFor(() => {
            expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                manufacturer: 'Honda',
                total_mileage: 30000,
                vin: '1HGCM82633A004352'
            })
            )
        })

        expect(eqMock).toHaveBeenCalledWith('id', 1)

        await waitFor(() => {
            expect(onVehicleUpdated).toHaveBeenCalledWith(updatedVehicle)
        })
    })


    it('VI-UT-FE-12 keeps the edit form open on database error', async () => {
        const singleMock = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
        })
        const selectMock = vi.fn(() => ({ single: singleMock }))
        const eqMock = vi.fn(() => ({ select: selectMock }))

        updateMock.mockReturnValue({ eq: eqMock })

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        try {
            renderVehicle()

            fireEvent.click(
                await screen.findByRole('button', { name: 'Editar' })
            )
            await screen.findByRole('option', { name: 'Obras Públicas' })

            fireEvent.change(screen.getByLabelText('Departamento'), {
            target: { value: '1' }
            })

            fireEvent.change(screen.getByLabelText('Estado'), {
            target: { value: 'true' }
            })

            fireEvent.submit(
            screen.getByRole('button', { name: 'Guardar cambios' }).closest('form')
            )

            await waitFor(() => {
            expect(updateMock).toHaveBeenCalled()
            expect(consoleSpy).toHaveBeenCalledWith(
                'Error updating vehicle:',
                expect.objectContaining({ message: 'Database error' })
            )
            })

            expect(
            screen.getByText('Editar información del vehículo')
            ).toBeInTheDocument()

            expect(onVehicleUpdated).not.toHaveBeenCalled()
        } finally {
            consoleSpy.mockRestore()
        }
    })


    
    it('VI-UT-FE-13 rejects empty required vehicle fields', async () => {
        const requiredFields = [
            'Tablilla',
            'Marca',
            'Modelo',
            'Año',
            'VIN',
            'Millaje total'
        ]

        for (const field of requiredFields) {
            cleanup()

            renderVehicle()

            fireEvent.click(
                await screen.findByRole('button', { name: 'Editar' })
            )

            await screen.findByRole('option', { name: 'Obras Públicas' })

            fireEvent.change(screen.getByLabelText(field), {
            target: { value: '' }
            })

            fireEvent.submit(
            screen.getByRole('button', { name: 'Guardar cambios' }).closest('form')
            )

            expect(
            updateMock,
            `${field} should be required`
            ).not.toHaveBeenCalled()

            expect(onVehicleUpdated).not.toHaveBeenCalled()
        }
    })



    it('VI-UT-FE-14 rejects a non-positive vehicle year', async () => {
        renderVehicle()

        fireEvent.click(
            await screen.findByRole('button', { name: 'Editar' })
        )

        await screen.findByRole('option', { name: 'Obras Públicas' })

        fireEvent.change(screen.getByLabelText('Año'), {
            target: { value: '-2020' }
        })

        fireEvent.submit(
            screen.getByRole('button', { name: 'Guardar cambios' }).closest('form')
        )

        expect(updateMock).not.toHaveBeenCalled()
        expect(onVehicleUpdated).not.toHaveBeenCalled()
    })


    it('VI-UT-FE-15 rejects negative mileage', async () => {
        renderVehicle()

        fireEvent.click(
            await screen.findByRole('button', { name: 'Editar' })
        )

        await screen.findByRole('option', { name: 'Obras Públicas' })

        fireEvent.change(screen.getByLabelText('Millaje total'), {
            target: { value: '-500' }
        })

        fireEvent.submit(
            screen.getByRole('button', { name: 'Guardar cambios' }).closest('form')
        )

        expect(updateMock).not.toHaveBeenCalled()
        expect(onVehicleUpdated).not.toHaveBeenCalled()
    })

    it('VI-UT-FE-16 denies editing to an admin without permission', async () => {
        isAdmin = true
        permissionAllowed = false

        renderVehicle()

        await waitFor(() => {
            expect(permissionQueryMock).toHaveBeenCalledTimes(1)
        })

        expect(
            screen.queryByRole('button', { name: 'Editar' })
        ).not.toBeInTheDocument()

        expect(updateMock).not.toHaveBeenCalled()
        })

        it('VI-UT-FE-17 shows Editar with update permission', async () => {
        permissionAllowed = true

        renderVehicle()

        expect(
            await screen.findByRole('button', { name: 'Editar' })
        ).toBeInTheDocument()
    })

})
