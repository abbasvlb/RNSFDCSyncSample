/*
 * Copyright (c) 2015-present, salesforce.com, inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided
 * that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of conditions and the
 * following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and
 * the following disclaimer in the documentation and/or other materials provided with the distribution.
 *
 * Neither the name of salesforce.com, inc. nor the names of its contributors may be used to endorse or
 * promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

import EventEmitter from "./events";
import { smartstore, mobilesync, forceUtil } from "react-native-force";

const registerSoup = forceUtil.promiser(smartstore.registerSoup);
const getSyncStatus = forceUtil.promiser(mobilesync.getSyncStatus);
const syncDown = forceUtil.promiserNoRejection(mobilesync.syncDown);
const syncUp = forceUtil.promiserNoRejection(mobilesync.syncUp);
const reSync = forceUtil.promiserNoRejection(mobilesync.reSync);

const syncName = "mobileSyncExplorerSyncDown";
let syncInFlight = false;
let lastStoreQuerySent = 0;
let lastStoreResponseReceived = 0;
const eventEmitter = new EventEmitter();

const SMARTSTORE_CHANGED = "smartstoreChanged";

function emitSmartStoreChanged() {
  eventEmitter.emit(SMARTSTORE_CHANGED, {});
}

function syncDownContacts() {
  if (syncInFlight) {
    console.log("Not starting syncDown - sync already in fligtht");
    return Promise.resolve();
  }

  console.log("Starting syncDown");
  syncInFlight = true;
  const fieldlist = ["FirstName", "LastName", "Id", "Email"];
  const target = {
    type: "soql",
    query: `select ${fieldlist.join(",")} from Contact`,
    // iOSImpl: "SFParentChildrenSyncDownTarget",
    // parent: {
    //   idFieldName: "Id",
    //   sobjectType: "Account",
    //   modificationDateFieldName: "LastModifiedDate",
    //   soupName: "Account",
    // },
    // parentFieldlist: ["Id", "Name", "Description"],
    // children: {
    //   parentIdFieldName: "AccountId",
    //   idFieldName: "Id",
    //   sobjectType: "Contact",
    //   modificationDateFieldName: "LastModifiedDate",
    //   soupName: "Contact",
    //   sobjectTypePlural: "Contacts",
    // },
    // childrenFieldlist: ["FirstName", "LastName", "Id", "Email", "AccountId"],
    // relationshipType: "MASTER_DETAIL",
    // parentSoqlFilter: "Name LIKE 'United Oil & Gas%' ",
    // type: "parent_children",
    // idFieldName: "Id",
  };
  return syncDown(
    false,
    target,
    "Contact",
    { mergeMode: mobilesync.MERGE_MODE.OVERWRITE },
    syncName
  ).then(() => {
    console.log("syncDown completed or failed");
    syncInFlight = false;
    emitSmartStoreChanged();
  });
}

function reSyncContacts() {
  if (syncInFlight) {
    console.log("Not starting reSync - sync already in fligtht");
    return Promise.resolve();
  }

  console.log("Starting reSync");
  syncInFlight = true;
  return reSync(false, syncName).then(() => {
    console.log("reSync completed or failed");
    syncInFlight = false;
    emitSmartStoreChanged();
  });
}

function syncUpContacts() {
  if (syncInFlight) {
    console.log("Not starting syncUp - sync already in fligtht");
    return Promise.resolve();
  }

  console.log("Starting syncUp");
  syncInFlight = true;
  const fieldlist = ["FirstName", "LastName", "Id", "Email"];

  const syncObj = {};
  // console.log(syncObj);
  // false,
  //   {
  //     iOSImpl: "SFParentChildrenSyncUpTarget",
  //     childrenCreateFieldlist: ["LastName", "AccountId"],
  //     parentCreateFieldlist: ["Id", "Name", "Description"],
  //     childrenUpdateFieldlist: ["LastName", "AccountId"],
  //     parentUpdateFieldlist: ["Name", "Description"],
  //     parent: {
  //       idFieldName: "Id",
  //       sobjectType: "Account",
  //       modificationDateFieldName: "LastModifiedDate",
  //       soupName: "Account",
  //     },
  //     relationshipType: "MASTER_DETAIL",
  //     type: "rest",
  //     modificationDateFieldName: "LastModifiedDate",
  //     children: {
  //       parentIdFieldName: "AccountId",
  //       idFieldName: "Id",
  //       sobjectType: "Contact",
  //       modificationDateFieldName: "LastModifiedDate",
  //       soupName: "Contact",
  //       sobjectTypePlural: "Contacts",
  //     },
  //     parentUpdateFieldlist: ["Name", "Description"],
  //     idFieldName: "Id",
  //   },
  //   "Account",
  //   {
  //     mergeMode: mobilesync.MERGE_MODE.LEAVE_IF_CHANGED,
  //     fieldlist,
  //   };
  return syncUp(
    false,
    {
      createFieldlist: fieldlist,
      updateFieldlist: fieldlist,
    },
    "Contact",
    {
      mergeMode: mobilesync.MERGE_MODE.OVERWRITE,
      fieldlist,
    }
  ).then(() => {
    console.log("syncUp completed or failed");
    syncInFlight = false;
    emitSmartStoreChanged();
  });
}

function firstTimeSyncData() {
  return registerSoup(false, "Contact", [
    { path: "Id", type: "string" },
    { path: "Email", type: "string" },
    { path: "IsActiveOne", type: "string" },
    { path: "__local__", type: "string" },
  ]).then(syncDownContacts);
}

function syncData() {
  return getSyncStatus(false, syncName).then((sync) => {
    if (sync == null) {
      return firstTimeSyncData();
    } else {
      return reSyncData();
    }
  });
}

function reSyncData() {
  // return reSyncContacts();
  return syncUpContacts().then(reSyncContacts);
}

function addStoreChangeListener(listener) {
  eventEmitter.addListener(SMARTSTORE_CHANGED, listener);
}

function saveContact(contact, callback) {
  smartstore.upsertSoupEntries(false, "ActionPlan", [contact], () => {
    callback();
    emitSmartStoreChanged();
  });
}

function addContact(successCallback, errorCallback) {
  var accountId = "";
  var contactId = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < 18; i++) {
    accountId += characters.charAt(
      Math.floor(Math.random() * charactersLength)
    );
    contactId += characters.charAt(
      Math.floor(Math.random() * charactersLength)
    );
  }

  const Account = {
    Id: accountId,
    Name: "United Oil & Gas",
    attributes: { type: "Contact" },
    __locally_created__: true,
    __locally_updated__: false,
    __locally_deleted__: false,
    __local__: true,
  };
  const contact = {
    FirstName: "From",
    LastName: "Mobile",
    Email: "frommobile@ivy.com",
    Id: contactId,
    AccountId: "001N0000024s2cpIAA",
    IsActiveOne: "yes",
    attributes: { type: "Contact" },
    __locally_created__: true,
    __locally_updated__: false,
    __locally_deleted__: false,
    __local__: true,
  };
  smartstore.upsertSoupEntries(
    false,
    "Contact",
    [contact],
    (Contact) => successCallback(Contact[0]),
    errorCallback
  );
  // smartstore.upsertSoupEntries(
  //   false,
  //   "Account",
  //   [Account],
  //   (account) => {
  //     const contact = {
  //       FirstName: "From",
  //       LastName: "Mobile",
  //       Email: "frommobile@ivy.com",
  //       Id: contactId,
  //       AccountId: account[0].Id,
  //       attributes: { type: "Contact" },
  //       __locally_created__: true,
  //       __locally_updated__: false,
  //       __locally_deleted__: false,
  //       __local__: true,
  //     };
  //   },
  //   errorCallback
  // );
}

function deleteContact(contact, successCallback, errorCallback) {
  smartstore.removeFromSoup(
    false,
    "Contact",
    [contact._soupEntryId],
    successCallback,
    errorCallback
  );
}

function traverseCursor(
  accumulatedResults,
  cursor,
  pageIndex,
  successCallback,
  errorCallback
) {
  accumulatedResults = accumulatedResults.concat(
    cursor.currentPageOrderedEntries
  );
  if (pageIndex < cursor.totalPages - 1) {
    smartstore.moveCursorToPageIndex(
      false,
      cursor,
      pageIndex + 1,
      (cursor) => {
        traverseCursor(
          accumulatedResults,
          cursor,
          pageIndex + 1,
          successCallback,
          errorCallback
        );
      },
      errorCallback
    );
  } else {
    successCallback(accumulatedResults);
  }
}

function searchContacts(queryId, query, successCallback, errorCallback) {
  let querySpec;

  if (query === "") {
    querySpec = smartstore.buildAllQuerySpec("Name", "ascending", 100);
  }
  // else {
  //   const queryParts = query.split(/ /);
  //   const queryFirst = queryParts.length == 2 ? queryParts[0] : query;
  //   const queryLast = queryParts.length == 2 ? queryParts[1] : query;
  //   const queryOp = queryParts.length == 2 ? "AND" : "OR";
  //   const match = `{ActionPlan:FirstName}:${queryFirst}* ${queryOp} {ActionPlan:LastName}:${queryLast}*`;
  //   querySpec = smartstore.buildMatchQuerySpec(
  //     null,
  //     match,
  //     "ascending",
  //     100,
  //     "LastName"
  //   );
  // }
  const that = this;

  const querySuccessCB = (ActionPlan) => {
    successCallback(ActionPlan, queryId);
  };

  const queryErrorCB = (error) => {
    console.log(`Error->${JSON.stringify(error)}`);
    errorCallback(error);
  };

  smartstore.querySoup(
    false,
    "Contact",
    querySpec,
    (cursor) => {
      traverseCursor([], cursor, 0, querySuccessCB, queryErrorCB);
    },
    queryErrorCB
  );
}

export default {
  syncData,
  reSyncData,
  addStoreChangeListener,
  saveContact,
  searchContacts,
  addContact,
  deleteContact,
};
