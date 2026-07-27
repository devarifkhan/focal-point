import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";

const InputField = (props) => {
    const active = props.textAlign ? "right-input-text" : "";
    const isError = props.isError || "";
    const isDisabled = props.isDisabled || false;
    const disabledClass = isDisabled ? "disabled" : "";
    const isMultiple = !!props.isMultiple;
    const [inputType, setInputType] = useState(props.type);
    const passwordVisiablityClick = () => {
        setInputType(inputType === "password" ? "text" : "password");
    };
    // console.log(inputType)
    return (
        <>
            <div className={`form-group ${props.className}`}>
                {
                    !props.floatingLabel && (
                        <label htmlFor="" className="form-label">
                            {props.label && (<span className={"name"}>{props.label} <strong className={props.asterisk ? "asterisk name" : "name"}>{props.asterisk && '*'}</strong></span>)}

                            {props.labelLink && (
                                <span className="link">
                                    <Link to={props.labelLink}>{props.labelLinkText}</Link>
                                </span>
                            )}
                            {props.labelOnChangeCallback && !props.showChangeField && (
                                <span className="link">
                                    <a href={void (0)} onClick={props.labelOnChangeCallback}>{props.labelLinkText}</a>
                                </span>
                            )}
                        </label>
                    )
                }
                {
                    props.icon && <span onClick={props.crossOnClick} className={props.iconDisabled ? 'input-icon disable' : 'input-icon'}><Icon icon={props.icon} /></span>
                }
                {
                    props.iconImg && <span className="input-icon"><img src={props.iconImg} alt="" /></span>
                }
                <input
                    id={props.id}
                    className={`form-input ${props.type === "file" ? "inp-file" : "input"} ${active} ${isError} ${disabledClass} ${props.inputClassName}`}
                    placeholder={props.placeholder}
                    accept={props.accept}
                    type={inputType}
                    value={props.value}
                    onChange={props.onchangeCallback}
                    onFocus={props.onFocus}
                    readOnly={props.readOnly}
                    onBlur={props.onBlur}
                    autoComplete="off"
                    name={props.inputName}
                    ref={props.inputRef}
                    multiple={isMultiple}
                    maxLength={props.maxLength}
                    minLength={props.minLength}
                    disabled={props.disabled}
                    max={props.maxDate}
                />
                {
                    props.floatingLabel && (
                        <label htmlFor="">
                            {props.label && (<span className={"name"}>{props.label} <strong className={props.asterisk ? "asterisk name" : "name"}>{props.asterisk && '*'}</strong></span>)}

                            {props.labelLink && (
                                <span className="link">
                                    <Link to={props.labelLink}>{props.labelLinkText}</Link>
                                </span>
                            )}
                            {props.labelOnChangeCallback && !props.showChangeField && (
                                <span className="link">
                                    <a href={void (0)} onClick={props.labelOnChangeCallback}>{props.labelLinkText}</a>
                                </span>
                            )}
                        </label>
                    )
                }
                {props.requiredMessage ? (
                    <span className="error-message">
                        {props.requiredMessageLabel}
                    </span>
                ) : props.whiteSpace === false ? ''
                    :
                    (
                        ' '
                    )
                }
                {props.type === "password" && (
                    <span className="password-visiablity" onClick={passwordVisiablityClick}>
                        {
                            inputType === "password" || props?.value?.length === 0 ?
                                <Icon icon={'ri:eye-off-line'} />
                                : <Icon icon={'lucide:eye'} />
                        }
                    </span>
                )}
            </div>

        </>
    )
}
export default InputField;