#![feature(proc_macro_hygiene)]
#[macro_use]
extern crate hdk;
extern crate hdk_proc_macros;
extern crate serde;
#[macro_use]
extern crate serde_derive;
#[macro_use]
extern crate serde_json;
extern crate holochain_json_derive;

use holochain_wasm_utils::api_serialization::{get_links::GetLinksResult, get_entry::GetEntryOptions};
use hdk::{
    entry_definition::ValidatingEntryType,
    error::ZomeApiResult,
};
use hdk::holochain_core_types::{
    entry::Entry,
    dna::entry_types::Sharing,
    time::Timeout,
    link::LinkMatch,
};

use hdk::holochain_json_api::{
    json::JsonString,
};

use hdk::holochain_persistence_api::{
    cas::content::Address
};

use hdk_proc_macros::zome;

#[zome]
mod my_zome {

    #[init]
    fn init() {
        Ok(())
    }

    #[validate_agent]
    fn validate_agent(validation_data: EntryValidationData<AgentId>) {
        Ok(())
    }

    #[receive]
    fn receive(from: Address, msg_json: String) -> String {
        // trigger a custom signal containing the message and sender
        hdk::emit_signal("message_received", json!({"from": from, "payload": msg_json})).unwrap();
        String::from("success")
    }

    #[entry_def]
     fn generic_entry_def() -> ValidatingEntryType {
        entry!(
            name: "generic_entry",
            description: "Entry with no validation not even on structure. Just an arbitrary string.",
            sharing: Sharing::Public,
            validation_package: || {
                hdk::ValidationPackageDefinition::ChainFull
            },
            validation: | _validation_data: hdk::EntryValidationData<String>| {
                Ok(())
            },
            links: [
                to!(
                    "generic_entry",
                    link_type: "",
                    validation_package: || {
                        hdk::ValidationPackageDefinition::Entry
                    },
                    validation: | _validation_data: hdk::LinkValidationData | {
                        Ok(())
                    }
                ),
                to!(
                    "%agent_id",
                    link_type: "entry_2_agent",
                    validation_package: || {
                        hdk::ValidationPackageDefinition::Entry
                    },
                    validation: | _validation_data: hdk::LinkValidationData | {
                        Ok(())
                    }
                ),
                from!(
                    "%agent_id",
                    link_type: "agent_2_entry",
                    validation_package: || {
                        hdk::ValidationPackageDefinition::Entry
                    },
                    validation: | _validation_data: hdk::LinkValidationData | {
                        Ok(())
                    }
                )
            ]
        )
    }

    #[zome_fn("hc_public")]
    fn whoami() -> ZomeApiResult<Address> {
        Ok(hdk::AGENT_ADDRESS.to_string().into())
    }

    #[zome_fn("hc_public")]
    fn commit_entry(content: String) -> ZomeApiResult<Address> {
        hdk::commit_entry(&Entry::App(
            "generic_entry".into(),
            JsonString::from_json(&content),
        ))
    }

    #[zome_fn("hc_public")]
    fn get_entry(address: Address) -> ZomeApiResult<Option<Entry>> {
        let mut options = GetEntryOptions::default();
        options.timeout = Timeout::new(2000);
        Ok(hdk::get_entry_result(&address, options)?.latest())
//        hdk::get_entry(&address)
    }

    #[zome_fn("hc_public")]
    fn update_entry(
        new_content: String,
        address: Address
    ) -> ZomeApiResult<Address> {
        hdk::update_entry(
            Entry::App("generic_entry".into(), JsonString::from_json(&new_content)),
            &address
        )
    }

    #[zome_fn("hc_public")]
    fn remove_entry(address: Address) -> ZomeApiResult<Address> {
        hdk::remove_entry(&address)
    }

    #[zome_fn("hc_public")]
    fn link_entries(
        base: Address,
        target: Address,
    ) -> ZomeApiResult<Address> {
        hdk::link_entries(&base, &target, "", "")
    }

    #[zome_fn("hc_public")]
    fn link_entries_typed(
        base: Address,
        target: Address,
        link_type: String
    ) -> ZomeApiResult<Address> {
        hdk::link_entries(&base, &target, link_type, "".to_string())
    }

    #[zome_fn("hc_public")]
    fn get_links(
        base: Address,
    ) -> ZomeApiResult<GetLinksResult> {
        hdk::get_links(&base, LinkMatch::Any, LinkMatch::Any)
    }

    #[zome_fn("hc_public")]
    fn send(
        to_agent: Address,
        payload: String,
    ) -> ZomeApiResult<String> {
        hdk::send(to_agent, payload, Timeout::new(5000))
    }

}
