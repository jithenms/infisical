import { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form"; 
import { faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { useNotificationContext } from "@app/components/context/Notifications/NotificationProvider";
import {
    Button,
    FormControl,
    IconButton,
    Input,
} from "@app/components/v2";
import {
    useOrganization,
    useSubscription
} from "@app/context";
import { 
    useAddIdentityUniversalAuth,
    useGetIdentityUniversalAuth,
    useUpdateIdentityUniversalAuth
} from "@app/hooks/api";
import { IdentityAuthMethod } from "@app/hooks/api/identities";
import { IdentityTrustedIp } from "@app/hooks/api/identities/types";
import { UsePopUpState } from "@app/hooks/usePopUp";

const schema = yup.object({
    accessTokenTTL: yup
        .string()
        .required("Access Token TTL is required"),
    accessTokenMaxTTL: yup
        .string()
        .required("Access Max Token TTL is required"),
    accessTokenNumUsesLimit: yup
        .string()
        .required("Access Token Max Number of Uses is required"),
    clientSecretTrustedIps: yup
        .array(
        yup.object({
            ipAddress: yup.string().max(50).required().label("IP Address")
        })
        )
        .min(1)
        .required()
        .label("Client Secret Trusted IP"),
    accessTokenTrustedIps: yup
        .array(
        yup.object({
            ipAddress: yup.string().max(50).required().label("IP Address")
        })
        )
        .min(1)
        .required()
        .label("Access Token Trusted IP")
}).required();

export type FormData = yup.InferType<typeof schema>;

type Props = {
    handlePopUpOpen: (popUpName: keyof UsePopUpState<["upgradePlan"]>) => void;
    handlePopUpToggle: (popUpName: keyof UsePopUpState<["identityAuthMethod"]>, state?: boolean) => void;
    identityAuthMethodData: {
        identityId: string;
        name: string;
        authMethod?: IdentityAuthMethod;
    }
}

export const IdentityUniversalAuthForm = ({
    handlePopUpOpen,
    handlePopUpToggle,
    identityAuthMethodData
}: Props) => {
    const { createNotification } = useNotificationContext();
    const { currentOrg } = useOrganization();
    const orgId = currentOrg?._id || "";
    const { subscription } = useSubscription();
    const { mutateAsync: addMutateAsync } = useAddIdentityUniversalAuth();
    const { mutateAsync: updateMutateAsync } = useUpdateIdentityUniversalAuth();
    const { data } = useGetIdentityUniversalAuth(identityAuthMethodData?.identityId ?? "");

    const {
        control,
        handleSubmit,
        reset,
        formState: { isSubmitting }
    } = useForm<FormData>({
        resolver: yupResolver(schema),
        defaultValues: {
            accessTokenTTL: "2592000",
            accessTokenMaxTTL: "2592000",
            accessTokenNumUsesLimit: "0",
            clientSecretTrustedIps: [
                { ipAddress: "0.0.0.0/0" },
                { ipAddress: "::/0" }
            ],
            accessTokenTrustedIps: [
                { ipAddress: "0.0.0.0/0" },
                { ipAddress: "::/0" }
            ],
        }
    });

    const {
        fields: clientSecretTrustedIpsFields, 
        append: appendClientSecretTrustedIp, 
        remove: removeClientSecretTrustedIp 
    } = useFieldArray({ control, name: "clientSecretTrustedIps" });
    const { 
        fields: accessTokenTrustedIpsFields, 
        append: appendAccessTokenTrustedIp, 
        remove: removeAccessTokenTrustedIp 
    } = useFieldArray({ control, name: "accessTokenTrustedIps" });
    
    useEffect(() => {
        if (data) {
            reset({
                accessTokenTTL: String(data.accessTokenTTL),
                accessTokenMaxTTL: String(data.accessTokenMaxTTL),
                accessTokenNumUsesLimit: String(data.accessTokenNumUsesLimit),
                clientSecretTrustedIps: data.clientSecretTrustedIps.map(({ 
                    ipAddress, 
                    prefix 
                }: IdentityTrustedIp) => {
                    return ({
                        ipAddress: `${ipAddress}${prefix !== undefined ? `/${prefix}` : ""}`
                    });
                }),
                accessTokenTrustedIps: data.accessTokenTrustedIps.map(({ 
                    ipAddress, 
                    prefix 
                }: IdentityTrustedIp) => {
                    return ({
                        ipAddress: `${ipAddress}${prefix !== undefined ? `/${prefix}` : ""}`
                    });
                })
            });
        } else {
            reset({
                accessTokenTTL: "2592000",
                accessTokenMaxTTL: "2592000",
                accessTokenNumUsesLimit: "0",
                clientSecretTrustedIps: [
                    { ipAddress: "0.0.0.0/0" },
                    { ipAddress: "::/0" }
                ],
                accessTokenTrustedIps: [
                    { ipAddress: "0.0.0.0/0" },
                    { ipAddress: "::/0" }
                ]
            });
        }
    }, [data]);

    const onFormSubmit = async ({
        accessTokenTTL,
        accessTokenMaxTTL,
        accessTokenNumUsesLimit,
        clientSecretTrustedIps,
        accessTokenTrustedIps
    }: FormData) => {
        try {
            
            if (!identityAuthMethodData) return;
            
            if (data) {
                // update universal auth configuration
                await updateMutateAsync({
                    organizationId: orgId,
                    identityId: identityAuthMethodData.identityId,
                    clientSecretTrustedIps,
                    accessTokenTTL: Number(accessTokenTTL),
                    accessTokenMaxTTL: Number(accessTokenMaxTTL),
                    accessTokenNumUsesLimit: Number(accessTokenNumUsesLimit),
                    accessTokenTrustedIps,
                });

            } else {
                // create new universal auth configuration

                await addMutateAsync({
                    organizationId: orgId,
                    identityId: identityAuthMethodData.identityId,
                    clientSecretTrustedIps,
                    accessTokenTTL: Number(accessTokenTTL),
                    accessTokenMaxTTL: Number(accessTokenMaxTTL),
                    accessTokenNumUsesLimit: Number(accessTokenNumUsesLimit),
                    accessTokenTrustedIps,
                });
            }
            
            handlePopUpToggle("identityAuthMethod", false);
            
            createNotification({
                text: `Successfully ${identityAuthMethodData?.authMethod ? "updated" : "configured"} auth method`,
                type: "success"
            });

            reset();
        } catch (err) {
            console.error(err);
            const error = err as any;
            const text = error?.response?.data?.message
                ?? `Failed to ${identityAuthMethodData?.authMethod ? "update" : "configure"} identity`;
            
            createNotification({
                text,
                type: "error"
            });
        }
    }
    
    return (
        <form onSubmit={handleSubmit(onFormSubmit)}>
            <Controller
                control={control}
                defaultValue="2592000"
                name="accessTokenTTL"
                render={({ field, fieldState: { error } }) => (
                    <FormControl
                        label="Access Token TTL (seconds)"
                        isError={Boolean(error)}
                        errorText={error?.message}
                    >
                    <Input 
                        {...field} 
                        placeholder="2592000"
                        type="number"
                        min="1"
                        step="1"
                    />
                    </FormControl>
                )}
            />
            <Controller
                control={control}
                defaultValue="2592000"
                name="accessTokenMaxTTL"
                render={({ field, fieldState: { error } }) => (
                    <FormControl
                        label="Access Token Max TTL (seconds)"
                        isError={Boolean(error)}
                        errorText={error?.message}
                    >
                    <Input 
                        {...field} 
                        placeholder="2592000"
                        type="number"
                        min="1"
                        step="1"
                    />
                    </FormControl>
                )}
            />
            <Controller
                control={control}
                defaultValue="0"
                name="accessTokenNumUsesLimit"
                render={({ field, fieldState: { error } }) => (
                    <FormControl
                        label="Access Token Max Number of Uses"
                        isError={Boolean(error)}
                        errorText={error?.message}
                    >
                    <Input 
                        {...field} 
                        placeholder="0"
                        type="number"
                        min="0"
                        step="1"
                    />
                    </FormControl>
                )}
            />
            {clientSecretTrustedIpsFields.map(({ id }, index) => (
                <div className="flex items-end space-x-2 mb-3" key={id}>
                    <Controller
                        control={control}
                        name={`clientSecretTrustedIps.${index}.ipAddress`}
                        defaultValue="0.0.0.0/0"
                        render={({ field, fieldState: { error } }) => {
                            return (
                                <FormControl
                                    className="mb-0 flex-grow"
                                    label={index === 0 ? "Client Secret Trusted IPs" : undefined}
                                    isError={Boolean(error)}
                                    errorText={error?.message}
                                >
                                <Input 
                                    value={field.value}
                                    onChange={(e) => {
                                        if (subscription?.ipAllowlisting) {
                                            field.onChange(e);
                                            return;
                                        }
                                        
                                        handlePopUpOpen("upgradePlan");
                                    }}
                                    placeholder="123.456.789.0" 
                                />
                                </FormControl>
                            );
                        }}
                    />
                    <IconButton
                        onClick={() => {
                            if (subscription?.ipAllowlisting) {
                                removeClientSecretTrustedIp(index);
                                return;
                            }
                            
                            handlePopUpOpen("upgradePlan");
                        }}
                        size="lg"
                        colorSchema="danger"
                        variant="plain"
                        ariaLabel="update"
                        className="p-3"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </IconButton>
                </div>
            ))}
            <div className="my-4 ml-1">
                <Button
                    variant="outline_bg"
                    onClick={() => {
                        if (subscription?.ipAllowlisting) {
                            appendClientSecretTrustedIp({
                                ipAddress: "0.0.0.0/0"
                            })
                            return;
                        }

                        handlePopUpOpen("upgradePlan");
                    }}
                    leftIcon={<FontAwesomeIcon icon={faPlus} />}
                    size="xs"
                >
                    Add IP Address
                </Button>
            </div>
            {accessTokenTrustedIpsFields.map(({ id }, index) => (
                <div className="flex items-end space-x-2 mb-3" key={id}>
                    <Controller
                        control={control}
                        name={`accessTokenTrustedIps.${index}.ipAddress`}
                        defaultValue="0.0.0.0/0"
                        render={({ field, fieldState: { error } }) => {
                            return (
                                <FormControl
                                    className="mb-0 flex-grow"
                                    label={index === 0 ? "Access Token Trusted IPs" : undefined}
                                    isError={Boolean(error)}
                                    errorText={error?.message}
                                >
                                <Input 
                                    value={field.value}
                                    onChange={(e) => {
                                        if (subscription?.ipAllowlisting) {
                                            field.onChange(e);
                                            return;
                                        }
                                        
                                        handlePopUpOpen("upgradePlan");
                                    }}
                                    placeholder="123.456.789.0" 
                                />
                                </FormControl>
                            );
                        }}
                    />
                    <IconButton
                        onClick={() => {
                            if (subscription?.ipAllowlisting) {
                                removeAccessTokenTrustedIp(index);
                                return;
                            }
                            
                            handlePopUpOpen("upgradePlan");
                        }}
                        size="lg"
                        colorSchema="danger"
                        variant="plain"
                        ariaLabel="update"
                        className="p-3"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </IconButton>
                </div>
            ))}
            <div className="my-4 ml-1">
                <Button
                    variant="outline_bg"
                    onClick={() => {
                        if (subscription?.ipAllowlisting) {
                            appendAccessTokenTrustedIp({
                                ipAddress: "0.0.0.0/0"
                            })
                            return;
                        }

                        handlePopUpOpen("upgradePlan");
                    }}
                    leftIcon={<FontAwesomeIcon icon={faPlus} />}
                    size="xs"
                >
                    Add IP Address
                </Button>
            </div>
            <div className="flex items-center">
                <Button
                    className="mr-4"
                    size="sm"
                    type="submit"
                    isLoading={isSubmitting}
                    isDisabled={isSubmitting}
                >
                    {identityAuthMethodData?.authMethod ? "Update" : "Configure"}
                </Button>
                <Button 
                    colorSchema="secondary" 
                    variant="plain"
                    onClick={() => handlePopUpToggle("identityAuthMethod", false)}
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
}