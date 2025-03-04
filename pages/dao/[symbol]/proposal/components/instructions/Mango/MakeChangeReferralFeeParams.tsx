/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useEffect, useState } from 'react'
import useRealm from '@hooks/useRealm'
import { PublicKey } from '@solana/web3.js'
import * as yup from 'yup'
import { isFormValid } from '@utils/formValidation'
import {
  MangoMakeChangeReferralFeeParams,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'
import { NewProposalContext } from '../../../new'
import useGovernanceAssets from '@hooks/useGovernanceAssets'
import { Governance, GovernanceAccountType } from '@solana/spl-governance'
import { ProgramAccount } from '@solana/spl-governance'
import useWalletStore from 'stores/useWalletStore'
import { serializeInstructionToBase64 } from '@solana/spl-governance'
import Input from '@components/inputs/Input'
import GovernedAccountSelect from '../../GovernedAccountSelect'
import { GovernedMultiTypeAccount, tryGetMint } from '@utils/tokens'
import { makeChangeReferralFeeParamsInstruction } from '@blockworks-foundation/mango-client'
import { BN } from '@project-serum/anchor'
import { MANGO_MINT } from 'Strategies/protocols/mango/tools'
import { parseMintNaturalAmountFromDecimal } from '@tools/sdk/units'

const MakeChangeReferralFeeParams = ({
  index,
  governance,
}: {
  index: number
  governance: ProgramAccount<Governance> | null
}) => {
  const wallet = useWalletStore((s) => s.current)
  const { realmInfo } = useRealm()
  const { getGovernancesByAccountTypes } = useGovernanceAssets()
  const connection = useWalletStore((s) => s.connection)
  const governedProgramAccounts = getGovernancesByAccountTypes([
    GovernanceAccountType.ProgramGovernanceV1,
    GovernanceAccountType.ProgramGovernanceV2,
  ]).map((x) => {
    return {
      governance: x,
    }
  })
  const shouldBeGoverned = index !== 0 && governance
  const programId: PublicKey | undefined = realmInfo?.programId
  const [form, setForm] = useState<MangoMakeChangeReferralFeeParams>({
    governedAccount: undefined,
    programId: programId?.toString(),
    mangoGroupKey: undefined,
    refSurchargeCentibps: 0,
    refShareCentibps: 0,
    refMngoRequired: 0,
  })
  const [formErrors, setFormErrors] = useState({})
  const { handleSetInstructions } = useContext(NewProposalContext)
  const handleSetForm = ({ propertyName, value }) => {
    setFormErrors({})
    setForm({ ...form, [propertyName]: value })
  }
  const validateInstruction = async (): Promise<boolean> => {
    const { isValid, validationErrors } = await isFormValid(schema, form)
    setFormErrors(validationErrors)
    return isValid
  }
  async function getInstruction(): Promise<UiInstruction> {
    const isValid = await validateInstruction()
    let serializedInstruction = ''
    if (
      isValid &&
      programId &&
      form.governedAccount?.governance?.account &&
      wallet?.publicKey
    ) {
      //Mango instruction call and serialize
      const mint = await tryGetMint(
        connection.current,
        new PublicKey(MANGO_MINT)
      )
      const refMngoRequiredMintAmount = parseMintNaturalAmountFromDecimal(
        form.refMngoRequired!,
        mint!.account.decimals
      )
      const setMaxMangoAccountsInstr = makeChangeReferralFeeParamsInstruction(
        form.governedAccount.governance.account.governedAccount,
        new PublicKey(form.mangoGroupKey!),
        form.governedAccount.governance.pubkey,
        new BN(form.refSurchargeCentibps),
        new BN(form.refShareCentibps),
        new BN(refMngoRequiredMintAmount)
      )

      serializedInstruction = serializeInstructionToBase64(
        setMaxMangoAccountsInstr
      )
    }
    const obj: UiInstruction = {
      serializedInstruction: serializedInstruction,
      isValid,
      governance: form.governedAccount?.governance,
    }
    return obj
  }
  useEffect(() => {
    handleSetForm({
      propertyName: 'programId',
      value: programId?.toString(),
    })
  }, [realmInfo?.programId])

  useEffect(() => {
    handleSetInstructions(
      { governedAccount: form.governedAccount?.governance, getInstruction },
      index
    )
  }, [form])
  const schema = yup.object().shape({
    governedAccount: yup
      .object()
      .nullable()
      .required('Program governed account is required'),
    mangoGroupKey: yup.string().required(),
    refShareCentibps: yup.number().required(),
    refMngoRequired: yup.number().required(),
    refSurchargeCentibps: yup.number().required(),
  })

  return (
    <>
      <GovernedAccountSelect
        label="Program"
        governedAccounts={governedProgramAccounts as GovernedMultiTypeAccount[]}
        onChange={(value) => {
          handleSetForm({ value, propertyName: 'governedAccount' })
        }}
        value={form.governedAccount}
        error={formErrors['governedAccount']}
        shouldBeGoverned={shouldBeGoverned}
        governance={governance}
      ></GovernedAccountSelect>
      <Input
        label="Mango group key"
        value={form.mangoGroupKey}
        type="text"
        onChange={(evt) =>
          handleSetForm({
            value: evt.target.value,
            propertyName: 'mangoGroupKey',
          })
        }
        error={formErrors['mangoGroupKey']}
      />
      <Input
        label="Ref surcharge centi bps"
        value={form.refSurchargeCentibps}
        type="number"
        min={0}
        onChange={(evt) =>
          handleSetForm({
            value: evt.target.value,
            propertyName: 'refSurchargeCentibps',
          })
        }
        error={formErrors['refSurchargeCentibps']}
      />
      <Input
        label="Ref share centi bps"
        value={form.refShareCentibps}
        type="number"
        min={0}
        onChange={(evt) =>
          handleSetForm({
            value: evt.target.value,
            propertyName: 'refShareCentibps',
          })
        }
        error={formErrors['refShareCentibps']}
      />
      <Input
        label="Ref mango required"
        value={form.refMngoRequired}
        type="number"
        min={0}
        onChange={(evt) =>
          handleSetForm({
            value: evt.target.value,
            propertyName: 'refMngoRequired',
          })
        }
        error={formErrors['refMngoRequired']}
      />
    </>
  )
}

export default MakeChangeReferralFeeParams
