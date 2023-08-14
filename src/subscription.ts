import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'


const matchText: string[] = [
  /* Conference hashtags */ '#sec ', 'sec football', '#acc ', 'acc football', 'pac-12 ', 'pac12 ', 'big10 ', 'big 10', 'big12 ', 'big 12', 'sunbelt ', 'funbelt ',
                            'conferenceUSA ', 'conference USA', '#cusa ', '#aac ', '#mountainwest ',  '#maction ',
  /* General hashtags  */   '#ncaafb ', '#cfb ', '#collegefootball ', 'fbs ', '#fcs ', '#d2fb ', '#appoll ', '#cfp', 'college football playoff','college football', '#cfbplayoff',
                            '#cfbsky', 'cfbsky ',
]

const matchPatterns: RegExp[] = [
  //
]

const filterWords = ["#secret", "security", "infosec", "opsec", "0xMonitor",]

// Include high profile TTRPG users here to always include their posts
const matchUsers: string[] = [
  "did:plc:ocytsitctktxvp4k3n2edgta", // @celebrityhottub.bsky.social
  "did:plc:htdzlq43nu33oqyoz2qzb4v3", // @cfbnumbers.bsky.social
  "did:plc:e3cyxeqboiqsybc3u6wvzysz", // @edsbs.bsky.social
  "did:plc:qqyyaunykg3yfeqt723ql6o5", // @espnbillc.bsky.social
  "did:plc:2gbjrnqzut3fzxdpha3kwetk", // @homefield.bsky.social
  "did:plc:fgpyya4en5thfmi6usrr3kvv", // @jasonkirk.fyi 
  "did:plc:fg5ks6bevpbwkha6o3s2y27h", // @kirshner.bsky.social
  "did:plc:cvgfgkowwcxwpcrr5o6dq4lg", // @mattbrown.bsky.social
  "did:plc:dxoa7yyqix3jxvavojvrujno", // @redditcfb.bsky.social
  "did:plc:w25tz6oy5vn53caepc5nqgyp", // @shutdownfullcast.bsky.social
  "did:plc:upyx3raxzpwlnzojrncogd7y", // @sickoscommittee.bsky.social
  "did:plc:wcslarfeolsmj2ootvmdfmja", // @solidverbal.bsky.social
  "did:plc:wshw46q252aihh7n6ybghgco", // @stevengodfrey.bsky.social
  "did:plc:swatff5g2ttnhavtwvtz3o4n", // @cfbplayoff.bsky.social        
]

// Exclude posts from these users
const bannedUsers: string[] = [
  //
]


export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)
    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        const txt = create.record.text.toLowerCase()
        return (
          (matchText.some((term) => txt.toLowerCase().includes(term)) ||
            matchPatterns.some((pattern) => pattern.test(txt)) ||
            matchUsers.includes(create.author)) &&
          !bannedUsers.includes(create.author)  &&
          !filterWords.some((term) => txt.toLowerCase().includes(term))
        )
      })
      .map((create) => {
        let doesTextMatch = matchText.some((term) => {
          console.log('searchterm: ', term, create.record.text.toLowerCase().includes(term))
          return create.record.text.toLowerCase().includes(term)
        })
        console.log(`Found post by ${create.author}: ${create.record.text}`, doesTextMatch, (matchUsers.includes(create.author)) &&
        !bannedUsers.includes(create.author))

        return {
          uri: create.uri,
          cid: create.cid,
          replyParent: create.record?.reply?.parent.uri ?? null,
          replyRoot: create.record?.reply?.root.uri ?? null,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}
